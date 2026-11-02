//! Smaller shapes: list entries that wrap a track or playlist, comments,
//! waveforms, search suggestions, home-page rows.

use serde::{Deserialize, Serialize};

use super::{Playlist, Track, User, text};
use crate::raw;

/// Anything `/resolve` or the mixed search can return, tagged by `kind`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Resource {
    Track(Track),
    User(User),
    Playlist(Playlist),
}

/// A feed or repost entry: either a track or a playlist, tagged by `kind`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum TrackOrPlaylist {
    Track(Track),
    Playlist(Playlist),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LikedTrack {
    pub liked_at: Option<String>,
    pub track: Track,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LikedPlaylist {
    pub liked_at: Option<String>,
    pub playlist: Playlist,
}

/// A play-history entry. SoundCloud lists a track once per play; each page
/// keeps only its latest play, and the UI should drop repeats across pages.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayedTrack {
    pub played_at: Option<String>,
    pub track: Track,
}

impl LikedTrack {
    pub(crate) fn from_raw(raw: raw::Like) -> Option<Self> {
        Some(Self {
            liked_at: text(raw.created_at),
            track: Track::from_raw(raw.track?),
        })
    }
}

impl LikedPlaylist {
    pub(crate) fn from_raw(raw: raw::Like) -> Option<Self> {
        Some(Self {
            liked_at: text(raw.created_at),
            playlist: Playlist::from_raw(raw.playlist?),
        })
    }
}

impl PlayedTrack {
    pub(crate) fn from_raw(raw: raw::Play) -> Option<Self> {
        Some(Self {
            played_at: raw.played_at,
            track: Track::from_raw(raw.track?),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Repost {
    pub reposted_at: Option<String>,
    pub caption: Option<String>,
    pub item: TrackOrPlaylist,
}

/// An entry of the feed from the people the user follows.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedItem {
    pub created_at: Option<String>,
    /// Who reposted it; `None` when the uploader posted it themselves.
    pub reposted_by: Option<User>,
    pub item: TrackOrPlaylist,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub id: u64,
    pub body: String,
    /// Milliseconds into the track; `None` for untimed comments.
    pub timestamp_ms: Option<u64>,
    pub created_at: Option<String>,
    pub user: Option<User>,
}

impl Comment {
    pub(crate) fn from_raw(raw: raw::Comment) -> Self {
        Self {
            id: raw.id,
            body: raw.body.unwrap_or_default(),
            timestamp_ms: raw.timestamp,
            created_at: text(raw.created_at),
            user: raw.user.map(User::from_raw),
        }
    }
}

/// A track's loudness outline: `samples` are bar heights from 0 to `height`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Waveform {
    pub width: u32,
    pub height: u32,
    pub samples: Vec<u32>,
}

impl Waveform {
    pub(crate) fn from_raw(raw: raw::Waveform) -> Self {
        Self {
            width: raw
                .width
                .unwrap_or_else(|| u32::try_from(raw.samples.len()).unwrap_or(u32::MAX)),
            height: raw
                .height
                .unwrap_or_else(|| raw.samples.iter().copied().max().unwrap_or(0)),
            samples: raw.samples,
        }
    }
}

/// An autocomplete suggestion: `output` to show, `query` to search for.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Suggestion {
    pub output: String,
    pub query: String,
}

impl Suggestion {
    pub(crate) fn from_raw(raw: raw::Suggestion) -> Option<Self> {
        let query = text(raw.query)?;
        Some(Self {
            output: text(raw.output).unwrap_or_else(|| query.clone()),
            query,
        })
    }
}

/// A row of the home page ("Curated by SoundCloud", "Artists to watch out for").
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Selection {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub playlists: Vec<Playlist>,
}

/// Keeps rows of playlists. Rows of anything else (e.g. "Trending by genre",
/// which holds system playlists) are dropped: they need routes this crate
/// does not speak.
pub(crate) fn selection(raw: raw::Selection) -> Option<Selection> {
    let items = raw
        .items
        .map(|items| items.collection.0)
        .unwrap_or_default();
    if items.is_empty() || items.iter().any(|item| item["kind"] != "playlist") {
        return None;
    }
    let playlists: Vec<Playlist> = items
        .into_iter()
        .filter_map(|item| serde_json::from_value::<raw::Playlist>(item).ok())
        .map(Playlist::from_raw)
        .collect();
    if playlists.is_empty() {
        return None;
    }
    Some(Selection {
        id: text(raw.urn).or_else(|| text(raw.id))?,
        title: raw.title.unwrap_or_default(),
        description: text(raw.description),
        playlists,
    })
}

fn track_or_playlist(kind: &str, raw: &mut raw::Activity) -> Option<TrackOrPlaylist> {
    match kind {
        "track" | "track-repost" => raw
            .track
            .take()
            .map(|t| TrackOrPlaylist::Track(Track::from_raw(t))),
        "playlist" | "playlist-repost" => raw
            .playlist
            .take()
            .map(|p| TrackOrPlaylist::Playlist(Playlist::from_raw(p))),
        _ => None,
    }
}

/// A feed entry; unknown types (promotions and the like) are dropped.
pub(crate) fn feed_item(mut raw: raw::Activity) -> Option<FeedItem> {
    let kind = raw.kind.take()?;
    let item = track_or_playlist(&kind, &mut raw)?;
    let reposted_by = if kind.ends_with("-repost") {
        raw.user.map(User::from_raw)
    } else {
        None
    };
    Some(FeedItem {
        created_at: text(raw.created_at),
        reposted_by,
        item,
    })
}

pub(crate) fn repost(mut raw: raw::Activity) -> Option<Repost> {
    let kind = raw.kind.take()?;
    if !kind.ends_with("-repost") {
        return None;
    }
    let item = track_or_playlist(&kind, &mut raw)?;
    Some(Repost {
        reposted_at: text(raw.created_at),
        caption: text(raw.caption),
        item,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn activity(json: &str) -> raw::Activity {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn feed_keeps_known_types_and_names_the_reposter() {
        let own = feed_item(activity(
            r#"{"type":"track","created_at":"2026-01-01T00:00:00Z","track":{"id":1,"title":"t"},
                "user":{"id":2,"username":"uploader"}}"#,
        ))
        .unwrap();
        assert!(own.reposted_by.is_none());
        assert!(matches!(own.item, TrackOrPlaylist::Track(ref t) if t.id == 1));

        let repost = feed_item(activity(
            r#"{"type":"playlist-repost","playlist":{"id":3,"title":"p"},"user":{"id":4,"username":"fan"}}"#,
        ))
        .unwrap();
        assert_eq!(repost.reposted_by.unwrap().username, "fan");
        assert!(matches!(repost.item, TrackOrPlaylist::Playlist(ref p) if p.id == 3));

        assert!(
            feed_item(activity(
                r#"{"type":"track-promoted","track":{"id":1,"title":"ad"}}"#
            ))
            .is_none()
        );
        assert!(feed_item(activity(r#"{"type":"track"}"#)).is_none());
    }

    #[test]
    fn reposts_are_only_reposts() {
        let entry = repost(activity(
            r#"{"type":"track-repost","caption":"","track":{"id":1,"title":"t"},"created_at":"2026-01-01T00:00:00Z"}"#,
        ))
        .unwrap();
        assert_eq!(entry.caption, None);
        assert!(repost(activity(r#"{"type":"track","track":{"id":1,"title":"t"}}"#)).is_none());
    }

    #[test]
    fn selections_keep_playlist_rows_only() {
        let rows: raw::Collection<raw::Selection> = serde_json::from_str(
            r#"{"collection":[
                {"urn":"soundcloud:selections:curated","title":"Curated by SoundCloud",
                 "items":{"collection":[{"kind":"playlist","id":1,"title":"a","tracks":[]}]}},
                {"urn":"soundcloud:selections:trending","title":"Trending by genre",
                 "items":{"collection":[{"kind":"system-playlist","urn":"soundcloud:system-playlists:x"}]}},
                {"urn":"soundcloud:selections:empty","title":"Empty","items":{"collection":[]}}
            ]}"#,
        )
        .unwrap();
        let kept: Vec<Selection> = rows
            .collection
            .0
            .into_iter()
            .filter_map(selection)
            .collect();
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].id, "soundcloud:selections:curated");
        assert_eq!(kept[0].playlists[0].title, "a");
    }

    #[test]
    fn resources_are_tagged_by_kind() {
        let user: raw::User = serde_json::from_str(r#"{"id":1,"username":"u"}"#).unwrap();
        let json = serde_json::to_value(Resource::User(User::from_raw(user))).unwrap();
        assert_eq!(json["kind"], "user");
        assert_eq!(json["username"], "u");
        let back: Resource = serde_json::from_value(json).unwrap();
        assert!(matches!(back, Resource::User(u) if u.id == 1));
    }

    #[test]
    fn waveform_fills_missing_dimensions() {
        let raw: raw::Waveform = serde_json::from_str(r#"{"samples":[1,5,3]}"#).unwrap();
        let waveform = Waveform::from_raw(raw);
        assert_eq!((waveform.width, waveform.height), (3, 5));
    }
}
