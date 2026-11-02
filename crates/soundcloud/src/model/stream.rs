//! Choosing what to play among a track's transcodings.
//!
//! A track lists several encodings of itself. Most tracks now carry only HLS
//! AAC; MP3 (progressive or HLS) survives on some tracks and on Go+ previews;
//! label releases often come only DRM-encrypted, which this app cannot play.

use serde::{Deserialize, Serialize};

use crate::raw;

/// A playable stream, resolved right before playing. The URL is signed and
/// short-lived: never cache it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stream {
    pub url: String,
    pub protocol: StreamProtocol,
    pub mime_type: String,
    /// A 30-second Go+ preview rather than the whole track.
    pub preview: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum StreamProtocol {
    /// One plain file; supports HTTP `Range`, plays in a bare `<audio>`.
    Progressive,
    /// An m3u8 playlist of segments; needs hls.js in the webview.
    Hls,
}

/// A transcoding worth resolving.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Candidate<'a> {
    pub url: &'a str,
    pub protocol: StreamProtocol,
    pub mime_type: &'a str,
    pub preview: bool,
}

/// The transcodings this app can play, best first.
///
/// Whole track before preview; then progressive MP3, HLS MP3, HLS AAC; within
/// one kind, higher quality first. Dropped: anything `encrypted` (FairPlay,
/// Widevine — there is no key, it would play silence), the `abr_*` adaptive
/// playlists (their resolve answers 404), and formats not listed above.
pub(crate) fn rank_transcodings(transcodings: &[raw::Transcoding]) -> Vec<Candidate<'_>> {
    let mut ranked: Vec<((bool, u8, u8), Candidate<'_>)> = transcodings
        .iter()
        .filter_map(|transcoding| {
            let url = transcoding.url.as_deref()?;
            let format = transcoding.format.as_ref()?;
            let protocol = format.protocol.as_deref()?;
            let preset = transcoding.preset.as_deref().unwrap_or_default();
            if protocol.contains("encrypted")
                || preset.contains("encrypted")
                || preset.starts_with("abr")
            {
                return None;
            }
            let mime_type = format.mime_type.as_deref().unwrap_or_default();
            let (protocol, kind_rank) = match (protocol, base_mime(mime_type).as_str()) {
                ("progressive", "audio/mpeg") => (StreamProtocol::Progressive, 0),
                ("hls", "audio/mpeg") => (StreamProtocol::Hls, 1),
                ("hls", "audio/mp4") => (StreamProtocol::Hls, 2),
                _ => return None,
            };
            let preview = transcoding.snipped.unwrap_or(false);
            let quality_rank = match transcoding.quality.as_deref() {
                Some("hq") => 0,
                Some("sq") => 1,
                Some("lq") => 2,
                _ => 3,
            };
            let candidate = Candidate {
                url,
                protocol,
                mime_type,
                preview,
            };
            Some(((preview, kind_rank, quality_rank), candidate))
        })
        .collect();
    // Stable: SoundCloud's own order breaks the remaining ties.
    ranked.sort_by_key(|(rank, _)| *rank);
    ranked.into_iter().map(|(_, candidate)| candidate).collect()
}

/// `audio/mp4; codecs="mp4a.40.2"` → `audio/mp4`.
fn base_mime(mime_type: &str) -> String {
    mime_type
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn transcoding(
        protocol: &str,
        mime: &str,
        preset: &str,
        quality: &str,
        snipped: bool,
    ) -> raw::Transcoding {
        raw::Transcoding {
            url: Some(format!(
                "https://api-v2.soundcloud.com/media/x/{preset}/{protocol}/{snipped}"
            )),
            preset: Some(preset.into()),
            snipped: Some(snipped),
            quality: Some(quality.into()),
            format: Some(raw::Format {
                protocol: Some(protocol.into()),
                mime_type: Some(mime.into()),
            }),
        }
    }

    const AAC: &str = "audio/mp4; codecs=\"mp4a.40.2\"";

    fn order(list: &[raw::Transcoding]) -> Vec<String> {
        rank_transcodings(list)
            .iter()
            .map(|c| {
                c.url
                    .trim_start_matches("https://api-v2.soundcloud.com/media/x/")
                    .to_owned()
            })
            .collect()
    }

    #[test]
    fn mp3_before_aac_and_progressive_before_hls() {
        let list = [
            transcoding("hls", AAC, "aac_160k", "sq", false),
            transcoding("hls", "audio/mpeg", "mp3_1_0", "sq", false),
            transcoding("progressive", "audio/mpeg", "mp3_1_0", "sq", false),
        ];
        assert_eq!(
            order(&list),
            [
                "mp3_1_0/progressive/false",
                "mp3_1_0/hls/false",
                "aac_160k/hls/false"
            ]
        );
        let best = &rank_transcodings(&list)[0];
        assert_eq!(best.protocol, StreamProtocol::Progressive);
        assert_eq!(best.mime_type, "audio/mpeg");
    }

    #[test]
    fn whole_track_before_preview() {
        let list = [
            transcoding("progressive", "audio/mpeg", "mp3_1_0", "sq", true),
            transcoding("hls", AAC, "aac_96k", "lq", false),
        ];
        assert_eq!(
            order(&list),
            ["aac_96k/hls/false", "mp3_1_0/progressive/true"]
        );
    }

    #[test]
    fn higher_quality_first_within_a_kind() {
        // The everyday case today: AAC only, the 96k one listed first.
        let list = [
            transcoding("hls", AAC, "aac_96k", "lq", false),
            transcoding("hls", "audio/mpegurl", "abr_sq", "sq", false),
            transcoding("hls", AAC, "aac_160k", "sq", false),
        ];
        assert_eq!(order(&list), ["aac_160k/hls/false", "aac_96k/hls/false"]);
    }

    #[test]
    fn encrypted_adaptive_and_unknown_formats_are_dropped() {
        let list = [
            transcoding("cbc-encrypted-hls", AAC, "aac_160k", "sq", false),
            transcoding("ctr-encrypted-hls", AAC, "aac_160k", "sq", false),
            transcoding("hls", AAC, "aac_160k_encrypted", "sq", false),
            transcoding("hls", "audio/mpegurl", "abr_sq", "sq", false),
            transcoding("hls", "audio/ogg; codecs=\"opus\"", "opus_0_0", "sq", false),
            transcoding("progressive", AAC, "aac_160k", "sq", false),
        ];
        assert!(rank_transcodings(&list).is_empty());
    }

    #[test]
    fn incomplete_entries_are_skipped() {
        let mut no_url = transcoding("hls", AAC, "aac_160k", "sq", false);
        no_url.url = None;
        let mut no_format = transcoding("hls", AAC, "aac_96k", "lq", false);
        no_format.format = None;
        assert!(rank_transcodings(&[no_url, no_format]).is_empty());
    }
}
