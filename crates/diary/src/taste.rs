//! What «Подборка» learns from: every closed play as a row of plain numbers,
//! and the tracks the diary can offer back — heard to the end lately (what
//! radios and related tracks grow from), last winter's, this week's a year ago,
//! and those heard to the end more than once.
//!
//! The diary only counts and remembers here. How much a skip or a finish
//! weighs is the selection's rule, in the frontend, where it can be read next
//! to the queue it shapes.

use chrono::{Datelike, Duration, NaiveDate};
use rusqlite::{Row, params};
use serde::Serialize;
use serde_json::Value;

use crate::error::Result;
use crate::setting::{Now, Place};
use crate::store::Diary;

/// The most plays handed over at once: years of listening, still small.
pub const MAX_TASTE_PLAYS: u32 = 50_000;
/// Tracks heard to the end lately: radios and related lists grow from the first few.
const SEEDS: u32 = 12;
/// Tracks one window (last winter, a year ago) can offer.
const WINDOW_TRACKS: u32 = 120;
/// Tracks heard to the end more than once that can come back.
const KEPT_TRACKS: u32 = 300;

/// How a play ended, as a number in [`PlayRow`].
pub mod outcome {
    pub const FINISHED: u8 = 0;
    pub const SKIPPED: u8 = 1;
    pub const REJECTED: u8 = 2;
    pub const AGAIN: u8 = 3;
    pub const STOPPED: u8 = 4;
}

/// Flags of a play in [`PlayRow`].
pub mod flag {
    /// Liked while it played.
    pub const LIKED: u8 = 1;
    /// «Больше такого» was pressed while it played.
    pub const MORE: u8 = 2;
    /// Put next by hand.
    pub const ADDED: u8 = 4;
}

/// One closed play: the track's id, its artist's id, when it started (ms since
/// 1970, UTC), how it ended ([`outcome`]), seconds really heard, seconds in
/// when it ended, the track's length in seconds, and [`flag`]s.
pub type PlayRow = (u64, Option<u64>, i64, u8, u32, u32, u32, u8);

/// A track heard to the end, and when last.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Finished {
    pub track: Value,
    pub at: i64,
}

/// A track from a window of time, and how many times it was heard out (or
/// liked) then.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Remembered {
    pub track: Value,
    pub times: u32,
}

/// An artist the diary has heard, by the name the app last showed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Artist {
    pub id: u64,
    pub name: String,
}

/// A stretch of the past — last winter, this week a year ago — and what was
/// heard in it. Its dates are there even when the diary does not reach back
/// that far, so the selection can say when it will.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Window {
    /// From and until (not included), ms since 1970.
    pub from: i64,
    pub to: i64,
    pub tracks: Vec<Remembered>,
}

/// Everything the selection reads from the diary at once.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Taste {
    /// Closed plays, newest first.
    pub plays: Vec<PlayRow>,
    /// When the oldest kept play started.
    pub since: Option<i64>,
    /// Heard to the end lately, newest first, each track once.
    pub finished: Vec<Finished>,
    pub winter: Window,
    pub year_ago: Window,
    /// Heard to the end more than once, the latest first.
    pub kept: Vec<Value>,
    /// Every artist the plays name, so what was learned can be told in names.
    pub artists: Vec<Artist>,
}

/// Plays of tracks that were never sent away with «не то».
const NOT_SENT_AWAY: &str = "p.track NOT IN (SELECT track FROM plays WHERE outcome = 'rejected')";

/// Heard to the end, or close to it, or liked, or asked for more of.
const HEARD_OUT: &str = "(p.outcome IN ('finished', 'again') OR p.liked = 1 OR p.more = 1
      OR (p.outcome = 'skipped' AND p.position_ms * 4 >= p.duration_ms * 3))";

impl Diary {
    /// What the selection learns from, as of `now`.
    pub fn taste(&self, now: &Now) -> Result<Taste> {
        let southern = Place::resolve(self.city()?.as_ref(), now.zone.as_deref())
            .is_some_and(|place| place.lat < 0.0);
        let (winter_from, winter_to) = last_winter(now.local().date(), southern);
        let (week_from, week_to) = week_a_year_ago(now.local().date());
        let at = |date: NaiveDate| local_midnight_ms(date, now.offset_min);
        Ok(Taste {
            plays: self.play_rows()?,
            since: self
                .db
                .query_row("SELECT MIN(started_at) FROM plays", [], |row| row.get(0))?,
            finished: self.finished_lately()?,
            winter: self.window(at(winter_from), at(winter_to))?,
            year_ago: self.window(at(week_from), at(week_to))?,
            kept: self.kept()?,
            artists: self.artists()?,
        })
    }

    fn artists(&self) -> Result<Vec<Artist>> {
        let mut statement = self.db.prepare_cached(
            "SELECT json_extract(json, '$.user.id') AS id, json_extract(json, '$.user.username')
             FROM tracks WHERE id IS NOT NULL GROUP BY id ORDER BY MAX(seen) DESC",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, Option<i64>>(0)?,
                row.get::<_, Option<String>>(1)?,
            ))
        })?;
        let mut out = Vec::new();
        for row in rows {
            if let (Some(id), Some(name)) = row?
                && let Ok(id) = u64::try_from(id)
            {
                out.push(Artist { id, name });
            }
        }
        Ok(out)
    }

    fn play_rows(&self) -> Result<Vec<PlayRow>> {
        let mut statement = self.db.prepare_cached(
            "SELECT p.track, json_extract(t.json, '$.id'), json_extract(t.json, '$.user.id'),
                    p.started_at, p.outcome, p.listened_ms, p.position_ms, p.duration_ms,
                    p.liked, p.more, p.added
             FROM plays p JOIN tracks t ON t.urn = p.track
             WHERE p.outcome IS NOT NULL
             ORDER BY p.started_at DESC, p.id DESC
             LIMIT ?1",
        )?;
        let rows = statement.query_map([MAX_TASTE_PLAYS], |row| {
            let urn: String = row.get(0)?;
            let id = row
                .get::<_, Option<i64>>(1)?
                .and_then(|id| u64::try_from(id).ok())
                .or_else(|| id_of_urn(&urn));
            let artist = row
                .get::<_, Option<i64>>(2)?
                .and_then(|id| u64::try_from(id).ok());
            let outcome = match row.get::<_, String>(4)?.as_str() {
                "finished" => outcome::FINISHED,
                "skipped" => outcome::SKIPPED,
                "rejected" => outcome::REJECTED,
                "again" => outcome::AGAIN,
                _ => outcome::STOPPED,
            };
            let mut flags = 0;
            for (column, bit) in [(8, flag::LIKED), (9, flag::MORE), (10, flag::ADDED)] {
                if row.get::<_, bool>(column)? {
                    flags |= bit;
                }
            }
            let at: i64 = row.get(3)?;
            let (heard, position, length) = (seconds(row, 5)?, seconds(row, 6)?, seconds(row, 7)?);
            Ok(id.map(|id| (id, artist, at, outcome, heard, position, length, flags)))
        })?;
        let mut plays = Vec::new();
        for row in rows {
            // A track kept without an id cannot be offered or counted; it is left out.
            if let Some(play) = row? {
                plays.push(play);
            }
        }
        Ok(plays)
    }

    fn finished_lately(&self) -> Result<Vec<Finished>> {
        let mut statement = self.db.prepare_cached(&format!(
            "SELECT t.json, MAX(p.started_at) AS at
             FROM plays p JOIN tracks t ON t.urn = p.track
             WHERE p.outcome IN ('finished', 'again') AND {NOT_SENT_AWAY}
             GROUP BY p.track ORDER BY at DESC LIMIT ?1"
        ))?;
        let rows = statement.query_map([SEEDS], |row| Ok((json(row, 0)?, row.get(1)?)))?;
        let mut out = Vec::new();
        for row in rows {
            let (track, at) = row?;
            out.push(Finished { track, at });
        }
        Ok(out)
    }

    fn window(&self, from: i64, to: i64) -> Result<Window> {
        let mut statement = self.db.prepare_cached(&format!(
            "SELECT t.json, COUNT(*) AS times, MAX(p.started_at) AS last
             FROM plays p JOIN tracks t ON t.urn = p.track
             WHERE p.started_at >= ?1 AND p.started_at < ?2 AND {HEARD_OUT} AND {NOT_SENT_AWAY}
             GROUP BY p.track ORDER BY times DESC, last DESC LIMIT ?3"
        ))?;
        let rows = statement.query_map(params![from, to, WINDOW_TRACKS], |row| {
            Ok(Remembered {
                track: json(row, 0)?,
                times: u32::try_from(row.get::<_, i64>(1)?).unwrap_or(u32::MAX),
            })
        })?;
        Ok(Window {
            from,
            to,
            tracks: rows.collect::<rusqlite::Result<_>>()?,
        })
    }

    fn kept(&self) -> Result<Vec<Value>> {
        let mut statement = self.db.prepare_cached(&format!(
            "SELECT t.json, COUNT(*) AS times, MAX(p.started_at) AS last
             FROM plays p JOIN tracks t ON t.urn = p.track
             WHERE p.outcome IN ('finished', 'again') AND {NOT_SENT_AWAY}
             GROUP BY p.track HAVING times >= 2 ORDER BY last DESC LIMIT ?1"
        ))?;
        let rows = statement.query_map([KEPT_TRACKS], |row| json(row, 0))?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }
}

/// The last winter that is over (or the one before, while it is winter):
/// December to February in the north, June to August in the south.
fn last_winter(today: NaiveDate, southern: bool) -> (NaiveDate, NaiveDate) {
    let (year, month) = (today.year(), today.month());
    if southern {
        let year = if month >= 9 { year } else { year - 1 };
        (date(year, 6, 1), date(year, 9, 1))
    } else {
        // The winter that ends in `ends`: from 1 December of the year before.
        let ends = if month <= 2 { year - 1 } else { year };
        (date(ends - 1, 12, 1), date(ends, 3, 1))
    }
}

/// The seven days around this date a year ago: three before, three after.
fn week_a_year_ago(today: NaiveDate) -> (NaiveDate, NaiveDate) {
    let then = today
        .with_year(today.year() - 1)
        // 29 February a year later is the 28th.
        .unwrap_or_else(|| date(today.year() - 1, today.month(), 28));
    (then - Duration::days(3), then + Duration::days(4))
}

fn date(year: i32, month: u32, day: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(year, month, day).unwrap_or_default()
}

/// Midnight of a local date, in ms since 1970 (UTC), by the clock's offset now.
fn local_midnight_ms(date: NaiveDate, offset_min: i32) -> i64 {
    date.and_hms_opt(0, 0, 0)
        .unwrap_or_default()
        .and_utc()
        .timestamp_millis()
        - i64::from(offset_min) * 60_000
}

/// The id at the end of `soundcloud:tracks:123`.
fn id_of_urn(urn: &str) -> Option<u64> {
    urn.rsplit(':').next()?.parse().ok()
}

fn seconds(row: &Row<'_>, index: usize) -> rusqlite::Result<u32> {
    let ms: i64 = row.get(index)?;
    Ok(u32::try_from(ms.max(0) / 1000).unwrap_or(u32::MAX))
}

fn json(row: &Row<'_>, index: usize) -> rusqlite::Result<Value> {
    let text: String = row.get(index)?;
    serde_json::from_str(&text).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            index,
            rusqlite::types::Type::Text,
            Box::new(error),
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setting::City;
    use crate::store::{Heard, NewPlay, Outcome, Source, SourceKind};
    use serde_json::json;

    const MINUTE: i64 = 60_000;
    const DAY: i64 = 24 * 60 * MINUTE;

    /// 4 November 2026, 19:00 in Moscow, `days` later (negative: earlier).
    fn moscow(days: i64) -> Now {
        Now {
            utc_ms: 1_793_808_000_000 + days * DAY,
            offset_min: 180,
            zone: Some("Europe/Moscow".into()),
        }
    }

    fn track(id: u64, artist: u64) -> NewPlay {
        NewPlay {
            urn: format!("soundcloud:tracks:{id}"),
            track: json!({ "id": id, "title": format!("t{id}"), "user": { "id": artist, "username": format!("a{artist}") } }),
            duration_ms: 200_000,
            from_ms: 0,
            source: Source {
                kind: SourceKind::Selection,
                title: None,
                id: None,
            },
            added: false,
        }
    }

    /// A play of `id` on `day` that ended as `outcome` after `heard_s` seconds.
    fn play(
        diary: &mut Diary,
        id: u64,
        artist: u64,
        day: i64,
        outcome: Outcome,
        heard_s: u64,
    ) -> i64 {
        let now = moscow(day);
        let play = diary.start(&track(id, artist), &now).unwrap();
        let heard = Heard {
            position_ms: heard_s * 1000,
            listened_ms: heard_s * 1000,
        };
        diary
            .end(play, outcome, heard, now.utc_ms + 5 * MINUTE)
            .unwrap();
        play
    }

    fn ids(values: &[Value]) -> Vec<u64> {
        values.iter().filter_map(|v| v["id"].as_u64()).collect()
    }

    #[test]
    fn an_empty_diary_still_knows_its_windows() {
        let diary = Diary::open_in_memory().unwrap();
        let taste = diary.taste(&moscow(0)).unwrap();
        assert!(taste.plays.is_empty() && taste.finished.is_empty() && taste.kept.is_empty());
        assert_eq!(taste.since, None);
        // Last winter, from Moscow in November 2026: 1 December 2025 to 1 March 2026.
        assert_eq!(taste.winter.from, local_midnight_ms(date(2025, 12, 1), 180));
        assert_eq!(taste.winter.to, local_midnight_ms(date(2026, 3, 1), 180));
        assert!(taste.winter.tracks.is_empty());
        // This week a year ago: 1 to 7 November 2025.
        assert_eq!(
            taste.year_ago.from,
            local_midnight_ms(date(2025, 11, 1), 180)
        );
        assert_eq!(taste.year_ago.to, local_midnight_ms(date(2025, 11, 8), 180));
    }

    #[test]
    fn plays_are_rows_of_numbers_newest_first() {
        let mut diary = Diary::open_in_memory().unwrap();
        play(&mut diary, 1, 10, -2, Outcome::Finished, 200);
        let rejected = play(&mut diary, 2, 20, -1, Outcome::Rejected, 6);
        let liked = play(&mut diary, 3, 30, 0, Outcome::Skipped, 75);
        diary.set_liked(liked, true).unwrap();
        diary.set_more(liked, true).unwrap();
        // Still playing: not part of what is learned yet.
        diary.start(&track(4, 40), &moscow(0)).unwrap();
        let taste = diary.taste(&moscow(0)).unwrap();
        assert_eq!(
            taste.plays,
            [
                (
                    3,
                    Some(30),
                    moscow(0).utc_ms,
                    outcome::SKIPPED,
                    75,
                    75,
                    200,
                    flag::LIKED | flag::MORE
                ),
                (
                    2,
                    Some(20),
                    moscow(-1).utc_ms,
                    outcome::REJECTED,
                    6,
                    6,
                    200,
                    0
                ),
                (
                    1,
                    Some(10),
                    moscow(-2).utc_ms,
                    outcome::FINISHED,
                    200,
                    200,
                    200,
                    0
                ),
            ]
        );
        assert!(diary.unreject(rejected).unwrap());
        assert_eq!(
            diary.taste(&moscow(0)).unwrap().plays[1].3,
            outcome::SKIPPED
        );
    }

    #[test]
    fn seeds_are_what_was_heard_to_the_end_lately_and_never_sent_away() {
        let mut diary = Diary::open_in_memory().unwrap();
        play(&mut diary, 1, 10, -5, Outcome::Finished, 200);
        play(&mut diary, 2, 20, -4, Outcome::Again, 200);
        play(&mut diary, 3, 30, -3, Outcome::Finished, 200);
        play(&mut diary, 3, 30, -1, Outcome::Rejected, 5);
        play(&mut diary, 1, 10, -2, Outcome::Finished, 200);
        play(&mut diary, 4, 40, 0, Outcome::Skipped, 20);
        let finished = diary.taste(&moscow(0)).unwrap().finished;
        let got: Vec<_> = finished
            .iter()
            .map(|f| (f.track["id"].as_u64(), f.at))
            .collect();
        assert_eq!(
            got,
            [(Some(1), moscow(-2).utc_ms), (Some(2), moscow(-4).utc_ms)]
        );
    }

    #[test]
    fn last_winter_offers_what_was_heard_out_then() {
        let mut diary = Diary::open_in_memory().unwrap();
        // 4 November 2026 minus 300 days is 9 January 2026: last winter.
        for day in [-300, -299, -298] {
            play(&mut diary, 1, 10, day, Outcome::Finished, 200);
        }
        play(&mut diary, 2, 20, -290, Outcome::Again, 200);
        play(&mut diary, 3, 30, -295, Outcome::Skipped, 12);
        play(&mut diary, 5, 50, -296, Outcome::Finished, 200);
        play(&mut diary, 5, 50, -10, Outcome::Rejected, 4);
        // Spring, outside the window.
        play(&mut diary, 6, 60, -200, Outcome::Finished, 200);
        let winter = diary.taste(&moscow(0)).unwrap().winter;
        let got: Vec<_> = winter
            .tracks
            .iter()
            .map(|r| (r.track["id"].as_u64(), r.times))
            .collect();
        assert_eq!(got, [(Some(1), 3), (Some(2), 1)]);
    }

    #[test]
    fn in_the_south_winter_is_june_to_august() {
        let mut diary = Diary::open_in_memory().unwrap();
        diary
            .set_city(Some(&City::new("Сидней", -33.87, 151.21).unwrap()))
            .unwrap();
        let sydney = Now {
            utc_ms: moscow(0).utc_ms,
            offset_min: 660,
            zone: Some("Australia/Sydney".into()),
        };
        let winter = diary.taste(&sydney).unwrap().winter;
        assert_eq!(winter.from, local_midnight_ms(date(2026, 6, 1), 660));
        assert_eq!(winter.to, local_midnight_ms(date(2026, 9, 1), 660));
    }

    #[test]
    fn winter_while_it_is_winter_means_the_one_before() {
        assert_eq!(
            last_winter(date(2027, 1, 15), false),
            (date(2025, 12, 1), date(2026, 3, 1))
        );
        assert_eq!(
            last_winter(date(2026, 12, 5), false),
            (date(2025, 12, 1), date(2026, 3, 1))
        );
        assert_eq!(
            last_winter(date(2027, 3, 1), false),
            (date(2026, 12, 1), date(2027, 3, 1))
        );
        assert_eq!(
            last_winter(date(2026, 7, 20), true),
            (date(2025, 6, 1), date(2025, 9, 1))
        );
        assert_eq!(
            week_a_year_ago(date(2028, 2, 29)),
            (date(2027, 2, 25), date(2027, 3, 4))
        );
    }

    #[test]
    fn this_week_a_year_ago_and_what_keeps_coming_back() {
        let mut diary = Diary::open_in_memory().unwrap();
        play(&mut diary, 1, 10, -364, Outcome::Finished, 200);
        play(&mut diary, 2, 20, -380, Outcome::Finished, 200);
        play(&mut diary, 3, 30, -6, Outcome::Finished, 200);
        play(&mut diary, 3, 30, -2, Outcome::Again, 200);
        play(&mut diary, 4, 40, -1, Outcome::Finished, 200);
        let taste = diary.taste(&moscow(0)).unwrap();
        let year_ago: Vec<_> = taste
            .year_ago
            .tracks
            .iter()
            .map(|r| r.track["id"].as_u64())
            .collect();
        assert_eq!(year_ago, [Some(1)]);
        assert_eq!(ids(&taste.kept), [3]);
        assert_eq!(taste.since, Some(moscow(-380).utc_ms));
        // Every artist the plays name, once.
        let mut artists: Vec<_> = taste.artists.iter().map(|a| a.id).collect();
        artists.sort_unstable();
        assert_eq!(artists, [10, 20, 30, 40]);
    }
}
