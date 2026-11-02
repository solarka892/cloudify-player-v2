//! The clean shapes handed to the frontend as JSON (camelCase keys,
//! kebab-case enum values), built from the raw API shapes with SoundCloud's
//! quirks already smoothed over: artwork fallbacks applied, tags split,
//! stubs filled in, empty strings turned into `None`.

mod artwork;
mod items;
mod playlist;
mod stream;
mod tags;
pub(crate) mod time;
mod track;
mod user;

pub use artwork::{ArtworkSize, artwork_url};
pub use items::{
    Comment, FeedItem, LikedPlaylist, LikedTrack, PlayedTrack, Repost, Resource, Selection,
    Suggestion, TrackOrPlaylist, Waveform,
};
pub use playlist::Playlist;
pub use stream::{Stream, StreamProtocol};
pub use track::{Monetization, Policy, Track, TrackAccess};
pub use user::{Me, Plan, User};

pub(crate) use items::{feed_item, repost, selection};
pub(crate) use playlist::restore_order;
pub(crate) use stream::rank_transcodings;

/// SoundCloud sends `""`, `null` and a missing key interchangeably.
fn text(value: Option<String>) -> Option<String> {
    value.filter(|text| !text.trim().is_empty())
}
