use url::Url;

use crate::client::Client;
use crate::error::{Error, ErrorKind, Result};
use crate::http::{self, Kind};
use crate::links;
use crate::model::{Stream, Waveform, rank_transcodings};
use crate::raw;

impl Client {
    /// Something playable for a track, resolved right before playing.
    ///
    /// Two hops, both with the session when signed in (a rights-restricted
    /// track refuses an anonymous caller): the track itself, for fresh
    /// transcodings and `track_authorization`, then the chosen transcoding,
    /// which answers with a signed, short-lived CDN URL. When a transcoding
    /// is refused, the next best one is tried. Nothing playable at all —
    /// only DRM-encrypted streams, or every one refused — is `NotAvailable`.
    pub async fn stream(&self, track_id: u64) -> Result<Stream> {
        let url = self.api_url(&format!("/tracks/{track_id}"), &[]);
        let track: raw::Track = self.get_json(url, Kind::Read).await?;
        let transcodings = track
            .media
            .map(|media| media.transcodings.0)
            .unwrap_or_default();
        let candidates = rank_transcodings(&transcodings);
        if candidates.is_empty() {
            return Err(Error::NotAvailable(
                "SoundCloud offers no stream this app can play (only encrypted ones, or none)"
                    .into(),
            ));
        }

        for candidate in candidates {
            let Ok(mut url) = Url::parse(candidate.url) else {
                continue;
            };
            // The session goes along, so the URL a payload names must be the API.
            if !links::same_origin(&url, &self.inner.api_base) {
                tracing::warn!(
                    host = url.host_str(),
                    "skipping a transcoding off the API host"
                );
                continue;
            }
            if let Some(authorization) = &track.track_authorization {
                url.query_pairs_mut()
                    .append_pair("track_authorization", authorization);
            }
            match self.get_json::<raw::StreamUrl>(url, Kind::Playback).await {
                Ok(raw::StreamUrl { url: Some(signed) }) if links::is_web_url(&signed) => {
                    return Ok(Stream {
                        url: signed,
                        protocol: candidate.protocol,
                        mime_type: candidate.mime_type.to_owned(),
                        preview: candidate.preview,
                    });
                }
                Ok(_) => tracing::debug!("a transcoding resolved to no usable URL"),
                Err(error) if refuses_only_this_stream(&error) => {
                    tracing::debug!(%error, "a transcoding was refused; trying the next");
                }
                Err(error) => return Err(error),
            }
        }
        Err(Error::NotAvailable(
            "SoundCloud refused every stream of this track here".into(),
        ))
    }

    /// The loudness outline behind a track's `waveform_url`. Only fetched
    /// from SoundCloud's waveform host: the URL comes out of a payload.
    pub async fn waveform(&self, waveform_url: &str) -> Result<Waveform> {
        let url = Url::parse(waveform_url)
            .map_err(|_| Error::invalid("the waveform URL is not a URL"))?;
        if !links::is_waveform_url(&url) {
            return Err(Error::invalid("waveforms only come from wave.sndcdn.com"));
        }
        let body = http::fetch_plain(&self.inner.http, url, "application/json", None).await?;
        let raw: raw::Waveform =
            serde_json::from_slice(&body).map_err(|err| Error::decode("waveform", &err))?;
        Ok(Waveform::from_raw(raw))
    }
}

/// Refusals that are about one transcoding, so the next one may still work.
fn refuses_only_this_stream(error: &Error) -> bool {
    matches!(
        error.kind(),
        ErrorKind::NotFound | ErrorKind::Forbidden | ErrorKind::Decode
    )
}
