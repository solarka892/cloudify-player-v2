use serde::{Deserialize, Serialize};

use super::artwork::track_artwork;
use super::stream::rank_transcodings;
use super::tags::parse_tags;
use super::{User, text};
use crate::raw;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: u64,
    pub urn: String,
    pub title: String,
    pub permalink_url: Option<String>,
    /// Falls back to the uploader's avatar when the track has no art of its own.
    pub artwork_url: Option<String>,
    /// What actually plays for this caller: 30 000 for a Go+ preview.
    pub duration_ms: u64,
    /// The whole song's length, preview or not.
    pub full_duration_ms: u64,
    /// The uploader.
    pub user: Option<User>,
    pub genre: Option<String>,
    pub tags: Vec<String>,
    pub description: Option<String>,
    pub created_at: Option<String>,
    pub playback_count: Option<u64>,
    pub likes_count: Option<u64>,
    pub reposts_count: Option<u64>,
    pub comment_count: Option<u64>,
    /// JSON, not an image: fetch it with `Client::waveform`.
    pub waveform_url: Option<String>,
    pub access: TrackAccess,
    /// The artist offers their own file and it has downloads left
    /// (`downloadable` alone stays `true` after a capped download runs out).
    pub downloadable: bool,
    pub license: Option<String>,
    pub label_name: Option<String>,
    pub purchase_url: Option<String>,
    pub purchase_title: Option<String>,
    pub private: bool,
}

/// Who may hear what, and how much of it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackAccess {
    pub policy: Policy,
    pub monetization: Monetization,
    /// soundcloud.com shows its Go+ badge exactly when this is set, for
    /// subscribers and everyone else alike.
    pub go_plus: bool,
    /// Only a 30-second preview plays for this caller.
    pub preview: bool,
    /// Offers a stream this app can play — not only DRM-encrypted ones.
    /// Taken from the transcodings in the payload; `true` when it had none to judge by.
    pub playable: bool,
}

/// `policy`, as the web app declares it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Policy {
    Allow,
    Monetize,
    Block,
    /// Only a preview plays (Go+ without a subscription).
    Snip,
    Unknown,
}

/// `monetization_model`, as the web app declares it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Monetization {
    NotApplicable,
    AdSupported,
    /// Go+.
    SubHighTier,
    Blackbox,
    Unknown,
}

impl Policy {
    fn from_api(value: Option<&str>) -> Self {
        match value {
            Some("ALLOW") => Self::Allow,
            Some("MONETIZE") => Self::Monetize,
            Some("BLOCK") => Self::Block,
            Some("SNIP") => Self::Snip,
            _ => Self::Unknown,
        }
    }
}

impl Monetization {
    fn from_api(value: Option<&str>) -> Self {
        match value {
            Some("NOT_APPLICABLE") => Self::NotApplicable,
            Some("AD_SUPPORTED") => Self::AdSupported,
            Some("SUB_HIGH_TIER") => Self::SubHighTier,
            Some("BLACKBOX") => Self::Blackbox,
            _ => Self::Unknown,
        }
    }
}

impl TrackAccess {
    fn from_raw(raw: &raw::Track) -> Self {
        let policy = Policy::from_api(raw.policy.as_deref());
        let monetization = Monetization::from_api(raw.monetization_model.as_deref());
        let playable = raw.streamable != Some(false)
            && raw
                .media
                .as_ref()
                .is_none_or(|media| !rank_transcodings(&media.transcodings.0).is_empty());
        Self {
            policy,
            monetization,
            go_plus: monetization == Monetization::SubHighTier,
            preview: policy == Policy::Snip,
            playable,
        }
    }
}

impl Track {
    pub(crate) fn from_raw(raw: raw::Track) -> Self {
        let access = TrackAccess::from_raw(&raw);
        let user = raw.user.map(User::from_raw);
        let artwork_url = track_artwork(
            text(raw.artwork_url),
            user.as_ref().and_then(|user| user.avatar_url.as_deref()),
        );
        let full_duration_ms = raw.full_duration.or(raw.duration).unwrap_or_default();
        Self {
            id: raw.id,
            urn: raw
                .urn
                .unwrap_or_else(|| format!("soundcloud:tracks:{}", raw.id)),
            title: raw.title.unwrap_or_default(),
            permalink_url: text(raw.permalink_url),
            artwork_url,
            duration_ms: raw.duration.unwrap_or(full_duration_ms),
            full_duration_ms,
            user,
            genre: text(raw.genre),
            tags: raw.tag_list.as_deref().map(parse_tags).unwrap_or_default(),
            description: text(raw.description),
            created_at: text(raw.created_at),
            playback_count: raw.playback_count,
            likes_count: raw.likes_count,
            reposts_count: raw.reposts_count,
            comment_count: raw.comment_count,
            waveform_url: text(raw.waveform_url),
            access,
            downloadable: raw.downloadable == Some(true) && raw.has_downloads_left != Some(false),
            license: text(raw.license),
            label_name: text(raw.label_name),
            purchase_url: text(raw.purchase_url),
            purchase_title: text(raw.purchase_title),
            private: raw.sharing.as_deref() == Some("private"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raw(json: &str) -> raw::Track {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn a_go_plus_preview_says_so() {
        let track = Track::from_raw(raw(
            r#"{"id":7,"title":"Song","duration":30000,"full_duration":201000,
                "policy":"SNIP","monetization_model":"SUB_HIGH_TIER",
                "media":{"transcodings":[{"url":"https://api-v2.soundcloud.com/media/a","preset":"mp3_1_0",
                  "snipped":true,"quality":"sq","format":{"protocol":"progressive","mime_type":"audio/mpeg"}}]}}"#,
        ));
        assert!(track.access.go_plus);
        assert!(track.access.preview);
        assert!(track.access.playable);
        assert_eq!(track.duration_ms, 30_000);
        assert_eq!(track.full_duration_ms, 201_000);
    }

    #[test]
    fn drm_only_tracks_are_not_playable() {
        let track = Track::from_raw(raw(
            r#"{"id":8,"title":"Label song","policy":"MONETIZE","monetization_model":"AD_SUPPORTED",
                "media":{"transcodings":[{"url":"https://api-v2.soundcloud.com/media/b","preset":"aac_160k",
                  "snipped":false,"quality":"sq",
                  "format":{"protocol":"cbc-encrypted-hls","mime_type":"audio/mp4; codecs=\"mp4a.40.2\""}}]}}"#,
        ));
        assert!(!track.access.playable);
        assert!(!track.access.go_plus);
        assert_eq!(track.access.policy, Policy::Monetize);
        assert_eq!(track.access.monetization, Monetization::AdSupported);
    }

    #[test]
    fn missing_art_falls_back_to_the_uploader() {
        let track = Track::from_raw(raw(r#"{"id":9,"title":"t","artwork_url":null,
                "user":{"id":1,"username":"u","avatar_url":"https://i1.sndcdn.com/avatars-1-large.jpg"}}"#));
        assert_eq!(
            track.artwork_url.as_deref(),
            Some("https://i1.sndcdn.com/avatars-1-large.jpg")
        );

        let default_avatar = Track::from_raw(raw(r#"{"id":9,"title":"t","artwork_url":"",
                "user":{"id":1,"username":"u","avatar_url":"https://a1.sndcdn.com/images/default_avatar_large.png"}}"#));
        assert_eq!(default_avatar.artwork_url, None);
    }

    #[test]
    fn fills_gaps_sensibly() {
        let track = Track::from_raw(raw(
            r#"{"id":10,"title":"t","duration":1000,"genre":"","tag_list":"a \"b c\"",
                "downloadable":true,"has_downloads_left":false,"sharing":"private"}"#,
        ));
        assert_eq!(track.urn, "soundcloud:tracks:10");
        assert_eq!(track.full_duration_ms, 1000);
        assert_eq!(track.genre, None);
        assert_eq!(track.tags, ["a", "b c"]);
        assert!(!track.downloadable);
        assert!(track.private);
        assert_eq!(track.access.policy, Policy::Unknown);
        assert!(track.access.playable);
    }

    #[test]
    fn serializes_in_camel_case() {
        let json = serde_json::to_value(Track::from_raw(raw(
            r#"{"id":1,"title":"t","policy":"SNIP"}"#,
        )))
        .unwrap();
        assert_eq!(json["durationMs"], 0);
        assert_eq!(json["access"]["goPlus"], false);
        assert_eq!(json["access"]["policy"], "snip");
        assert!(json.get("duration_ms").is_none());
    }
}
