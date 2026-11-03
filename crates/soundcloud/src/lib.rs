//! Everything that talks to SoundCloud lives in this crate and nowhere else.
//!
//! SoundCloud has issued no API keys since 2015, so this speaks the same
//! internal API (`api-v2.soundcloud.com`) the website uses. It can change
//! without notice; keeping it behind one crate means one place to fix.
//! The routes and their quirks are written down in `docs/soundcloud-api.md`.
//!
//! Start with [`Client`]. Every method returns the clean models of this
//! crate, ready to be sent to the frontend as JSON, or an [`Error`] whose
//! [`ErrorKind`] the UI turns into plain words.

#![forbid(unsafe_code)]

mod auth;
mod client;
mod client_id;
mod endpoints;
mod error;
mod http;
mod links;
mod model;
mod paging;
mod raw;

pub use auth::Token;
pub use client::{Client, ClientBuilder};
pub use endpoints::search::{
    CreatedWithin, DurationFilter, GenreCount, LicenseFilter, TrackFilters,
};
pub use error::{Error, ErrorKind, Result};
pub use model::{
    ArtworkSize, Comment, FeedItem, LikedPlaylist, LikedTrack, Me, Monetization, Plan, PlayedTrack,
    Playlist, Policy, Repost, Resource, Selection, Stream, StreamProtocol, Suggestion, Track,
    TrackAccess, TrackOrPlaylist, User, Waveform, artwork_url,
};
pub use paging::{Cursor, MAX_LIMIT, OffsetRequest, Page, PageRequest, SearchPage};
