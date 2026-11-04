//! The listening diary: every play Cloudify makes, kept in one SQLite file on
//! this computer, each with how it ended and the setting it happened in (the
//! part of the day, the weekday, the season, how long the day was and whether
//! the sun was up). The selection will learn from it.
//!
//! Nothing here touches the network: the sun is worked out from the date and
//! a latitude, and the latitude is a city the person named or, until they do,
//! the city their time zone is named after.
//!
//! «Подборка» reads it through [`Diary::taste`]: every closed play as plain
//! numbers, and the tracks it can offer back.
//!
//! Start with [`Diary`]: [`Diary::start`] when a track's sound starts,
//! [`Diary::progress`] while it plays, [`Diary::end`] when it ends.

#![forbid(unsafe_code)]

mod error;
mod setting;
mod store;
mod sun;
mod taste;
mod zones;

pub use error::{Error, Result};
pub use setting::{City, Now, PartOfDay, Place, PlaceFrom, Season, Setting, Weekday, ZoneCity};
pub use store::{
    DaySummary, Diary, Heard, MAX_PAGE, NewPlay, Outcome, Page, Play, Settings, Source, SourceKind,
};
pub use sun::{altitude, day_length, sunrise_sunset};
pub use taste::{
    Artist, Finished, MAX_TASTE_PLAYS, PlayRow, Remembered, Taste, Window, flag, outcome,
};
