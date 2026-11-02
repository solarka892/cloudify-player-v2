//! SoundCloud's own JSON shapes, exactly as api-v2 sends them.
//!
//! Private on purpose: the frontend gets the clean models in `model`, so a
//! renamed field here is fixed in one conversion, not across the UI.
//! Everything but ids is optional — the API leaves fields out, sends `null`
//! and `""` interchangeably, and trims objects down to stubs.

use std::marker::PhantomData;

use serde::Deserialize;
use serde::de::{self, DeserializeOwned, Deserializer, SeqAccess, Visitor};

/// A list that survives odd items: one entry in an unexpected shape is
/// skipped (and logged) instead of failing the whole page.
#[derive(Debug, Clone)]
pub(crate) struct Lenient<T>(pub Vec<T>);

impl<T> Default for Lenient<T> {
    fn default() -> Self {
        Self(Vec::new())
    }
}

impl<'de, T: DeserializeOwned> Deserialize<'de> for Lenient<T> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct Items<T>(PhantomData<T>);

        impl<'de, T: DeserializeOwned> Visitor<'de> for Items<T> {
            type Value = Lenient<T>;

            fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                f.write_str("a list")
            }

            fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
                Ok(Lenient(Vec::new()))
            }

            fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
                Ok(Lenient(Vec::new()))
            }

            fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Self::Value, A::Error> {
                let mut items = Vec::with_capacity(seq.size_hint().unwrap_or(0));
                while let Some(value) = seq.next_element::<serde_json::Value>()? {
                    match T::deserialize(value) {
                        Ok(item) => items.push(item),
                        Err(error) => {
                            tracing::debug!(%error, "skipping an item in an unexpected shape")
                        }
                    }
                }
                Ok(Lenient(items))
            }
        }

        deserializer.deserialize_any(Items(PhantomData))
    }
}

/// `{ collection, next_href, total_results }`, the envelope of every list.
#[derive(Debug, Deserialize)]
#[serde(bound(deserialize = "T: DeserializeOwned"))]
pub(crate) struct Collection<T> {
    #[serde(default)]
    pub collection: Lenient<T>,
    pub next_href: Option<String>,
    pub total_results: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Track {
    pub id: u64,
    pub urn: Option<String>,
    pub title: Option<String>,
    pub permalink_url: Option<String>,
    pub artwork_url: Option<String>,
    pub duration: Option<u64>,
    pub full_duration: Option<u64>,
    pub user: Option<User>,
    pub genre: Option<String>,
    pub tag_list: Option<String>,
    pub description: Option<String>,
    pub created_at: Option<String>,
    pub playback_count: Option<u64>,
    pub likes_count: Option<u64>,
    pub reposts_count: Option<u64>,
    pub comment_count: Option<u64>,
    pub waveform_url: Option<String>,
    pub media: Option<Media>,
    pub track_authorization: Option<String>,
    pub policy: Option<String>,
    pub monetization_model: Option<String>,
    pub streamable: Option<bool>,
    pub downloadable: Option<bool>,
    pub has_downloads_left: Option<bool>,
    pub license: Option<String>,
    pub label_name: Option<String>,
    pub purchase_url: Option<String>,
    pub purchase_title: Option<String>,
    pub sharing: Option<String>,
}

impl Track {
    /// Playlists send only their first few tracks whole; the rest are
    /// `{ id, kind, policy, monetization_model }` stubs.
    pub fn is_complete(&self) -> bool {
        self.title.is_some()
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct Media {
    #[serde(default)]
    pub transcodings: Lenient<Transcoding>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Transcoding {
    pub url: Option<String>,
    pub preset: Option<String>,
    pub snipped: Option<bool>,
    pub quality: Option<String>,
    pub format: Option<Format>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Format {
    pub protocol: Option<String>,
    pub mime_type: Option<String>,
}

/// The second playback hop: `{ "url": "<signed CDN url>" }`.
#[derive(Debug, Deserialize)]
pub(crate) struct StreamUrl {
    pub url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct User {
    pub id: u64,
    pub urn: Option<String>,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub permalink_url: Option<String>,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub city: Option<String>,
    pub country_code: Option<String>,
    pub followers_count: Option<u64>,
    pub followings_count: Option<u64>,
    pub track_count: Option<u64>,
    pub playlist_count: Option<u64>,
    pub likes_count: Option<u64>,
    pub verified: Option<bool>,
    pub visuals: Option<Visuals>,
    /// Only on `/me`, and only believed: not yet seen signed in.
    pub consumer_subscription: Option<Subscription>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Visuals {
    pub visuals: Option<Vec<Visual>>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Visual {
    pub visual_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Subscription {
    pub product: Option<Product>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Product {
    pub id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Playlist {
    pub id: u64,
    /// Absent from playlist objects in practice; built from the id instead.
    pub urn: Option<String>,
    pub title: Option<String>,
    pub permalink_url: Option<String>,
    pub artwork_url: Option<String>,
    pub is_album: Option<bool>,
    pub user: Option<User>,
    pub track_count: Option<u32>,
    pub duration: Option<u64>,
    pub sharing: Option<String>,
    pub created_at: Option<String>,
    pub likes_count: Option<u64>,
    pub reposts_count: Option<u64>,
    pub description: Option<String>,
    pub genre: Option<String>,
    pub tag_list: Option<String>,
    #[serde(default)]
    pub tracks: Lenient<Track>,
}

/// `/users/{id}/likes` and `/users/{id}/playlist_likes`.
#[derive(Debug, Deserialize)]
pub(crate) struct Like {
    pub created_at: Option<String>,
    pub track: Option<Track>,
    pub playlist: Option<Playlist>,
}

/// `/me/play-history/tracks`.
#[derive(Debug, Deserialize)]
pub(crate) struct Play {
    #[serde(default, deserialize_with = "crate::model::time::lenient_timestamp")]
    pub played_at: Option<String>,
    pub track: Option<Track>,
}

/// An entry of the feed (`/stream`) or of someone's reposts.
#[derive(Debug, Deserialize)]
pub(crate) struct Activity {
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub created_at: Option<String>,
    pub caption: Option<String>,
    pub track: Option<Track>,
    pub playlist: Option<Playlist>,
    pub user: Option<User>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct Comment {
    pub id: u64,
    pub body: Option<String>,
    /// Milliseconds into the track; absent on untimed comments.
    pub timestamp: Option<u64>,
    pub created_at: Option<String>,
    pub user: Option<User>,
}

/// A row of `/mixed-selections`, the website's home page.
#[derive(Debug, Deserialize)]
pub(crate) struct Selection {
    pub id: Option<String>,
    pub urn: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub items: Option<Collection<serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct Suggestion {
    pub output: Option<String>,
    pub query: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct Waveform {
    pub width: Option<u32>,
    pub height: Option<u32>,
    #[serde(default)]
    pub samples: Vec<u32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn odd_items_are_skipped_not_fatal() {
        let page: Collection<Track> = serde_json::from_str(
            r#"{"collection":[{"id":1,"title":"a"},{"id":"not a number"},{"title":"no id"},{"id":2}],
                "next_href":null}"#,
        )
        .unwrap();
        let ids: Vec<u64> = page.collection.0.iter().map(|t| t.id).collect();
        assert_eq!(ids, [1, 2]);
        assert!(page.next_href.is_none());
    }

    #[test]
    fn missing_or_null_lists_are_empty() {
        let page: Collection<Track> = serde_json::from_str(r#"{"collection":null}"#).unwrap();
        assert!(page.collection.0.is_empty());
        let page: Collection<Track> = serde_json::from_str("{}").unwrap();
        assert!(page.collection.0.is_empty());
    }

    #[test]
    fn stubs_are_told_from_complete_tracks() {
        let stub: Track = serde_json::from_str(
            r#"{"id":39390117,"kind":"track","monetization_model":"BLACKBOX","policy":"MONETIZE"}"#,
        )
        .unwrap();
        assert!(!stub.is_complete());
        let full: Track = serde_json::from_str(r#"{"id":1,"title":"Flickermood"}"#).unwrap();
        assert!(full.is_complete());
    }
}
