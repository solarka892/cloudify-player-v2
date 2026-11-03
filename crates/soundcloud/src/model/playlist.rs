use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use super::artwork::{is_default_avatar, playlist_artwork, track_artwork};
use super::tags::parse_tags;
use super::{Track, User, text};
use crate::raw;

/// A playlist or an album.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: u64,
    pub urn: String,
    pub title: String,
    pub permalink_url: Option<String>,
    /// Falls back to the first track's art, then to the owner's avatar.
    pub artwork_url: Option<String>,
    pub is_album: bool,
    /// The owner.
    pub user: Option<User>,
    pub track_count: u32,
    pub duration_ms: u64,
    pub private: bool,
    pub created_at: Option<String>,
    pub likes_count: Option<u64>,
    pub reposts_count: Option<u64>,
    pub description: Option<String>,
    pub genre: Option<String>,
    pub tags: Vec<String>,
    /// Up to four different artworks of its first tracks, for a 2×2 mosaic.
    /// Lists carry the first few tracks whole, so this costs no extra request.
    pub covers: Vec<String>,
    /// Every track, complete and in order — filled by `Client::playlist` and
    /// `Client::resolve` only. Lists leave it out to stay light; `track_count`
    /// still says how many there are.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tracks: Option<Vec<Track>>,
}

impl Playlist {
    /// The summary, without tracks: SoundCloud sends only the first few
    /// whole anyway.
    pub(crate) fn from_raw(raw: raw::Playlist) -> Self {
        Self::split(raw).0
    }

    /// The summary, and the track entries it came with (complete tracks and
    /// stubs, in order).
    pub(crate) fn split(mut raw: raw::Playlist) -> (Self, Vec<raw::Track>) {
        let entries = std::mem::take(&mut raw.tracks.0);
        let user = raw.user.map(User::from_raw);
        let first_track_art = entries
            .first()
            .and_then(|track| track.artwork_url.as_deref())
            .filter(|url| !url.trim().is_empty());
        let artwork_url = playlist_artwork(
            text(raw.artwork_url),
            first_track_art,
            user.as_ref().and_then(|user| user.avatar_url.as_deref()),
        );
        let covers = mosaic(&entries);
        let playlist = Self {
            id: raw.id,
            urn: raw
                .urn
                .unwrap_or_else(|| format!("soundcloud:playlists:{}", raw.id)),
            title: raw.title.unwrap_or_default(),
            permalink_url: text(raw.permalink_url),
            artwork_url,
            is_album: raw.is_album.unwrap_or(false),
            user,
            track_count: raw.track_count.unwrap_or_default(),
            duration_ms: raw.duration.unwrap_or_default(),
            private: raw.sharing.as_deref() == Some("private"),
            created_at: text(raw.created_at),
            likes_count: raw.likes_count,
            reposts_count: raw.reposts_count,
            description: text(raw.description),
            genre: text(raw.genre),
            tags: raw.tag_list.as_deref().map(parse_tags).unwrap_or_default(),
            covers,
            tracks: None,
        };
        (playlist, entries)
    }
}

/// Covers in a playlist mosaic.
const MOSAIC: usize = 4;

/// The first different artworks among the complete entries, each falling back
/// to its uploader's avatar the way a track's own artwork does.
fn mosaic(entries: &[raw::Track]) -> Vec<String> {
    let mut covers: Vec<String> = Vec::with_capacity(MOSAIC);
    for entry in entries.iter().filter(|entry| entry.is_complete()) {
        let avatar = entry
            .user
            .as_ref()
            .and_then(|user| user.avatar_url.as_deref())
            .filter(|url| !url.trim().is_empty() && !is_default_avatar(url));
        let Some(cover) = track_artwork(text(entry.artwork_url.clone()), avatar) else {
            continue;
        };
        if !covers.contains(&cover) {
            covers.push(cover);
        }
        if covers.len() == MOSAIC {
            break;
        }
    }
    covers
}

/// Puts fetched tracks back in the playlist's order.
///
/// `/tracks?ids=` answers in its own order. A playlist can hold the same
/// track twice, and ids SoundCloud no longer returns (deleted, made private)
/// simply drop out.
pub(crate) fn restore_order(order: &[u64], fetched: Vec<Track>) -> Vec<Track> {
    let by_id: HashMap<u64, Track> = fetched.into_iter().map(|track| (track.id, track)).collect();
    order
        .iter()
        .filter_map(|id| by_id.get(id).cloned())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(id: u64) -> Track {
        Track::from_raw(
            serde_json::from_value(serde_json::json!({ "id": id, "title": format!("t{id}") }))
                .unwrap(),
        )
    }

    fn ids(tracks: &[Track]) -> Vec<u64> {
        tracks.iter().map(|t| t.id).collect()
    }

    #[test]
    fn restores_the_requested_order() {
        let fetched = vec![track(3), track(1), track(2)];
        assert_eq!(ids(&restore_order(&[1, 2, 3], fetched)), [1, 2, 3]);
    }

    #[test]
    fn keeps_repeats_and_drops_missing() {
        let fetched = vec![track(2), track(1)];
        assert_eq!(ids(&restore_order(&[1, 9, 2, 1], fetched)), [1, 2, 1]);
        assert!(restore_order(&[], vec![track(1)]).is_empty());
    }

    #[test]
    fn artwork_falls_back_to_first_track_then_owner() {
        let raw: raw::Playlist = serde_json::from_str(
            r#"{"id":5,"title":"p","artwork_url":null,
                "user":{"id":1,"username":"u","avatar_url":"https://i1.sndcdn.com/avatars-1-large.jpg"},
                "tracks":[{"id":10,"title":"a","artwork_url":"https://i1.sndcdn.com/artworks-10-large.jpg"},
                          {"id":11,"kind":"track","policy":"ALLOW"}]}"#,
        )
        .unwrap();
        let playlist = Playlist::from_raw(raw.clone());
        assert_eq!(
            playlist.artwork_url.as_deref(),
            Some("https://i1.sndcdn.com/artworks-10-large.jpg")
        );
        assert_eq!(playlist.urn, "soundcloud:playlists:5");
        assert_eq!(playlist.tracks, None);

        let mut bare = raw;
        bare.tracks.0.clear();
        let playlist = Playlist::from_raw(bare);
        assert_eq!(
            playlist.artwork_url.as_deref(),
            Some("https://i1.sndcdn.com/avatars-1-large.jpg")
        );
    }

    #[test]
    fn covers_are_the_first_different_artworks_of_complete_tracks() {
        let raw: raw::Playlist = serde_json::from_str(
            r#"{"id":5,"title":"p","tracks":[
                {"id":1,"title":"a","artwork_url":"https://i1.sndcdn.com/artworks-1-large.jpg"},
                {"id":2,"title":"b","artwork_url":"https://i1.sndcdn.com/artworks-1-large.jpg"},
                {"id":3,"title":"c","artwork_url":null,
                 "user":{"id":9,"username":"u","avatar_url":"https://i1.sndcdn.com/avatars-9-large.jpg"}},
                {"id":4,"title":"d","artwork_url":"",
                 "user":{"id":8,"username":"v","avatar_url":"https://a1.sndcdn.com/images/default_avatar_large.png"}},
                {"id":5,"kind":"track","policy":"ALLOW"},
                {"id":6,"title":"f","artwork_url":"https://i1.sndcdn.com/artworks-6-large.jpg"},
                {"id":7,"title":"g","artwork_url":"https://i1.sndcdn.com/artworks-7-large.jpg"},
                {"id":8,"title":"h","artwork_url":"https://i1.sndcdn.com/artworks-8-large.jpg"}
            ]}"#,
        )
        .unwrap();
        let playlist = Playlist::from_raw(raw);
        assert_eq!(
            playlist.covers,
            [
                "https://i1.sndcdn.com/artworks-1-large.jpg",
                "https://i1.sndcdn.com/avatars-9-large.jpg",
                "https://i1.sndcdn.com/artworks-6-large.jpg",
                "https://i1.sndcdn.com/artworks-7-large.jpg",
            ]
        );
        let bare: raw::Playlist = serde_json::from_str(r#"{"id":6,"title":"empty"}"#).unwrap();
        let json = serde_json::to_value(Playlist::from_raw(bare)).unwrap();
        assert_eq!(json["covers"], serde_json::json!([]));
    }

    #[test]
    fn summaries_serialize_without_tracks() {
        let raw: raw::Playlist =
            serde_json::from_str(r#"{"id":5,"title":"p","is_album":true}"#).unwrap();
        let json = serde_json::to_value(Playlist::from_raw(raw)).unwrap();
        assert!(json.get("tracks").is_none());
        assert_eq!(json["isAlbum"], true);
    }
}
