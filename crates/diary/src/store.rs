//! The diary's file: one SQLite database on this computer.
//!
//! A play is written when its sound starts, kept up to date while it plays
//! (where it is, how much was really heard) and closed with how it ended. A
//! play the app never got to close (it was quit mid-song) is closed on the
//! next start as stopped where it was last heard of. Each track is kept once,
//! as the app last showed it, so the diary still reads when a track is gone
//! from SoundCloud.

use std::path::Path;

use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{Error, Result};
use crate::setting::{City, Now, Place, Setting, ZoneCity};

/// Raised when the tables change in a way an older version could not read,
/// with a step in `migrate`. A column an older version can simply ignore is
/// added in place instead (see `add_missing_columns`), so a file opened by
/// this version still opens in the one before it.
const SCHEMA_VERSION: i32 = 1;

/// Columns added after version 1 that older versions ignore: name and definition.
const LATER_COLUMNS: &[(&str, &str)] = &[
    // «Больше такого» was pressed while the play went on.
    ("more", "INTEGER NOT NULL DEFAULT 0"),
];

const SCHEMA_V1: &str = "
CREATE TABLE tracks (
    urn  TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    seen INTEGER NOT NULL
) STRICT;

CREATE TABLE plays (
    id           INTEGER PRIMARY KEY,
    track        TEXT NOT NULL REFERENCES tracks (urn),
    started_at   INTEGER NOT NULL,
    utc_offset   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    ended_at     INTEGER,
    outcome      TEXT,
    from_ms      INTEGER NOT NULL,
    position_ms  INTEGER NOT NULL,
    listened_ms  INTEGER NOT NULL,
    duration_ms  INTEGER NOT NULL,
    liked        INTEGER NOT NULL DEFAULT 0,
    source_kind  TEXT NOT NULL,
    source_title TEXT,
    source_id    INTEGER,
    added        INTEGER NOT NULL DEFAULT 0,
    setting      TEXT NOT NULL
) STRICT;

CREATE INDEX plays_by_time ON plays (started_at, id);
CREATE INDEX plays_by_track ON plays (track, started_at);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
) STRICT;
";

const KEEP_DAYS: &str = "keep_days";
const CITY: &str = "city";
const DAY_MS: i64 = 86_400_000;
/// The most plays one page hands out.
pub const MAX_PAGE: u32 = 500;

/// Where the queue a track played from came from, as the player names it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceKind {
    Selection,
    Likes,
    Playlist,
    History,
    Reposts,
    Artist,
    Station,
    Search,
    /// The track the app picked up where it stopped last time.
    Resume,
    /// Played again from the diary itself (an evening, a night).
    Diary,
    /// A kind this version does not know (written by a newer one).
    #[serde(other)]
    Other,
}

impl SourceKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Selection => "selection",
            Self::Likes => "likes",
            Self::Playlist => "playlist",
            Self::History => "history",
            Self::Reposts => "reposts",
            Self::Artist => "artist",
            Self::Station => "station",
            Self::Search => "search",
            Self::Resume => "resume",
            Self::Diary => "diary",
            Self::Other => "other",
        }
    }

    fn parse(text: &str) -> Self {
        serde_json::from_value(Value::String(text.to_owned())).unwrap_or(Self::Other)
    }
}

/// Where a play came from: the kind of queue, and its name where it has one
/// (a playlist's title, the search query, the artist).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub kind: SourceKind,
    #[serde(default)]
    pub title: Option<String>,
    /// The playlist's id, for a playlist.
    #[serde(default)]
    pub id: Option<u64>,
}

/// How a play ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Outcome {
    /// Played to the end.
    Finished,
    /// Left before the end for another track; `position_ms` says where.
    Skipped,
    /// Left with «не то»: skipped, and said so.
    Rejected,
    /// Started over: on repeat, or sent back to its beginning.
    Again,
    /// Ended without moving on by choice: the app was closed, the track broke off.
    Stopped,
}

impl Outcome {
    fn as_str(self) -> &'static str {
        match self {
            Self::Finished => "finished",
            Self::Skipped => "skipped",
            Self::Rejected => "rejected",
            Self::Again => "again",
            Self::Stopped => "stopped",
        }
    }

    fn parse(text: &str) -> Option<Self> {
        serde_json::from_value(Value::String(text.to_owned())).ok()
    }
}

/// A play starting: what the app knows the moment the sound starts.
#[derive(Debug, Clone, PartialEq)]
pub struct NewPlay {
    /// The track's stable name (`soundcloud:tracks:123`).
    pub urn: String,
    /// The track as the app showed it; kept to show the diary later.
    pub track: Value,
    /// What could play: 30 000 for a Go+ preview.
    pub duration_ms: u64,
    /// Where in the track the sound began (a resumed track starts mid-way).
    pub from_ms: u64,
    pub source: Source,
    /// The person put it next by hand («Играть следующим»).
    pub added: bool,
}

/// How far a play got.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Heard {
    /// Where in the track it is (or was when it ended).
    pub position_ms: u64,
    /// How much sound was really heard: seeking past a part does not count.
    pub listened_ms: u64,
}

/// One play, as the diary shows it.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Play {
    pub id: i64,
    /// The track as the app showed it when it last played.
    pub track: Value,
    /// When the sound started, in milliseconds since 1970 (UTC).
    pub started_at: i64,
    /// Minutes the clock ran ahead of UTC then: the day and hour it was there.
    pub utc_offset: i32,
    pub ended_at: Option<i64>,
    /// `None` while it plays.
    pub outcome: Option<Outcome>,
    pub from_ms: u64,
    pub position_ms: u64,
    pub listened_ms: u64,
    pub duration_ms: u64,
    /// Liked while it played.
    pub liked: bool,
    /// «Больше такого» was pressed while it played.
    pub more: bool,
    pub source: Source,
    pub added: bool,
    pub setting: Setting,
}

/// Plays, newest first, and where to go on from.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Page {
    pub items: Vec<Play>,
    /// Pass back as `before` for older plays; `None` at the first play ever.
    pub next: Option<String>,
}

/// One day of listening, as the strip of days shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DaySummary {
    /// The local date, `2026-11-04`.
    pub day: String,
    pub plays: u64,
    pub heard_ms: u64,
}

/// What the diary keeps and where it thinks the person is.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Plays older than this many days are let go; `None` keeps them all.
    pub keep_days: Option<u32>,
    /// The city the person named, if they did.
    pub city: Option<City>,
    /// Their time zone's city, standing in until they name one.
    pub zone: Option<ZoneCity>,
    /// How many plays are kept.
    pub plays: u64,
    /// When the oldest kept play started.
    pub since: Option<i64>,
}

/// The listening diary, open.
pub struct Diary {
    pub(crate) db: Connection,
}

impl Diary {
    /// Opens the diary's file, making it (and its folder) on first use.
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(folder) = path.parent() {
            std::fs::create_dir_all(folder)?;
        }
        Self::prepare(Connection::open(path)?)
    }

    /// A diary that lives only as long as it is open: for tests.
    pub fn open_in_memory() -> Result<Self> {
        Self::prepare(Connection::open_in_memory()?)
    }

    fn prepare(db: Connection) -> Result<Self> {
        // A crash loses at most the last moments, never the file.
        db.pragma_update_and_check(None, "journal_mode", "WAL", |_| Ok(()))?;
        db.pragma_update(None, "synchronous", "NORMAL")?;
        db.pragma_update(None, "foreign_keys", true)?;
        // What is erased is overwritten, not just forgotten.
        db.pragma_update(None, "secure_delete", true)?;
        migrate(&db)?;
        Ok(Self { db })
    }

    /// Closes the plays the app never got to close (it was quit mid-song) as
    /// stopped where they were last heard of. Run once at start.
    pub fn recover(&mut self) -> Result<usize> {
        close_strays(&self.db)
    }

    /// Writes down a play whose sound has just started; returns its id.
    /// One track sounds at a time, so a play still open from before (the
    /// window was reloaded mid-song) is closed as stopped first.
    pub fn start(&mut self, play: &NewPlay, now: &Now) -> Result<i64> {
        if play.urn.is_empty() {
            return Err(Error::Invalid("a play needs its track's urn".into()));
        }
        let city = self.city()?;
        let setting = Setting::at(now, Place::resolve(city.as_ref(), now.zone.as_deref()));
        let tx = self.db.transaction()?;
        close_strays(&tx)?;
        tx.execute(
            "INSERT INTO tracks (urn, json, seen) VALUES (?1, ?2, ?3)
             ON CONFLICT (urn) DO UPDATE SET json = excluded.json, seen = excluded.seen
             WHERE excluded.seen >= tracks.seen",
            params![play.urn, play.track.to_string(), now.utc_ms],
        )?;
        tx.execute(
            "INSERT INTO plays (track, started_at, utc_offset, updated_at, from_ms, position_ms,
                                listened_ms, duration_ms, source_kind, source_title, source_id,
                                added, setting)
             VALUES (?1, ?2, ?3, ?2, ?4, ?4, 0, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                play.urn,
                now.utc_ms,
                now.offset_min,
                ms(play.from_ms),
                ms(play.duration_ms),
                play.source.kind.as_str(),
                play.source.title,
                play.source.id.map(ms),
                play.added,
                serde_json::to_string(&setting)?,
            ],
        )?;
        let id = tx.last_insert_rowid();
        tx.commit()?;
        Ok(id)
    }

    /// Notes how far a play has got. A closed play is left as it ended.
    pub fn progress(&mut self, id: i64, heard: Heard, now_ms: i64) -> Result<()> {
        self.db.execute(
            "UPDATE plays SET position_ms = ?2, listened_ms = MAX(listened_ms, ?3), updated_at = ?4
             WHERE id = ?1 AND outcome IS NULL",
            params![id, ms(heard.position_ms), ms(heard.listened_ms), now_ms],
        )?;
        Ok(())
    }

    /// Closes a play with how it ended. Closing it again changes nothing:
    /// `false` says it was already closed (or never existed).
    pub fn end(&mut self, id: i64, outcome: Outcome, heard: Heard, now_ms: i64) -> Result<bool> {
        let changed = self.db.execute(
            "UPDATE plays SET outcome = ?2, position_ms = ?3, listened_ms = MAX(listened_ms, ?4),
                              updated_at = ?5, ended_at = ?5
             WHERE id = ?1 AND outcome IS NULL",
            params![
                id,
                outcome.as_str(),
                ms(heard.position_ms),
                ms(heard.listened_ms),
                now_ms
            ],
        )?;
        Ok(changed == 1)
    }

    /// The track was liked (or the like taken back) while this play went on.
    pub fn set_liked(&mut self, id: i64, liked: bool) -> Result<()> {
        self.db.execute(
            "UPDATE plays SET liked = ?2 WHERE id = ?1",
            params![id, liked],
        )?;
        Ok(())
    }

    /// «Больше такого» was pressed (or taken back) while this play went on.
    pub fn set_more(&mut self, id: i64, more: bool) -> Result<()> {
        self.db.execute(
            "UPDATE plays SET more = ?2 WHERE id = ?1",
            params![id, more],
        )?;
        Ok(())
    }

    /// «Не то» taken back: the play reads as simply skipped where it was left.
    /// `false` when it did not end with «не то».
    pub fn unreject(&mut self, id: i64) -> Result<bool> {
        let changed = self.db.execute(
            "UPDATE plays SET outcome = 'skipped' WHERE id = ?1 AND outcome = 'rejected'",
            [id],
        )?;
        Ok(changed == 1)
    }

    /// Plays, newest first: up to `limit` from before the `before` cursor of
    /// an earlier page, or from the latest.
    pub fn plays(&self, before: Option<&str>, limit: u32) -> Result<Page> {
        self.find(before, limit, None)
    }

    /// Like [`Diary::plays`], only the plays of tracks whose title or artist
    /// holds `words` (any case, any alphabet); every play for `None` or blanks.
    pub fn find(&self, before: Option<&str>, limit: u32, words: Option<&str>) -> Result<Page> {
        let limit = limit.clamp(1, MAX_PAGE);
        let (at, id) = match before {
            Some(cursor) => parse_cursor(cursor)?,
            None => (i64::MAX, i64::MAX),
        };
        // SQLite folds only Latin case, so the matching tracks are picked here.
        let only = match words.map(str::trim).filter(|words| !words.is_empty()) {
            Some(words) => Some(serde_json::to_string(&self.tracks_matching(words)?)?),
            None => None,
        };
        let mut statement = self.db.prepare_cached(
            "SELECT p.id, t.json, p.started_at, p.utc_offset, p.ended_at, p.outcome, p.from_ms,
                    p.position_ms, p.listened_ms, p.duration_ms, p.liked, p.source_kind,
                    p.source_title, p.source_id, p.added, p.setting, p.more
             FROM plays p JOIN tracks t ON t.urn = p.track
             WHERE (p.started_at, p.id) < (?1, ?2)
               AND (?4 IS NULL OR p.track IN (SELECT value FROM json_each(?4)))
             ORDER BY p.started_at DESC, p.id DESC
             LIMIT ?3",
        )?;
        let mut items = statement
            .query_map(params![at, id, i64::from(limit) + 1, only], play_of_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let next = if items.len() > limit as usize {
            items.truncate(limit as usize);
            items
                .last()
                .map(|last| format!("{}:{}", last.started_at, last.id))
        } else {
            None
        };
        Ok(Page { items, next })
    }

    /// The kept tracks whose title or artist holds `words`, by their urns.
    fn tracks_matching(&self, words: &str) -> Result<Vec<String>> {
        let words = words.to_lowercase();
        let mut statement = self.db.prepare_cached("SELECT urn, json FROM tracks")?;
        let rows = statement.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut found = Vec::new();
        for row in rows {
            let (urn, json) = row?;
            let track: Value = serde_json::from_str(&json).unwrap_or_default();
            let said = |value: &Value| value.as_str().map(str::to_lowercase).unwrap_or_default();
            if said(&track["title"]).contains(&words)
                || said(&track["user"]["username"]).contains(&words)
            {
                found.push(urn);
            }
        }
        Ok(found)
    }

    /// The latest `limit` days that have plays, newest first: how many plays
    /// and how much was heard on each, by the clock where they were played.
    pub fn days(&self, limit: u32) -> Result<Vec<DaySummary>> {
        let mut statement = self.db.prepare_cached(
            "SELECT strftime('%Y-%m-%d', started_at / 1000 + utc_offset * 60, 'unixepoch') AS day,
                    COUNT(*), SUM(listened_ms)
             FROM plays GROUP BY day ORDER BY day DESC LIMIT ?1",
        )?;
        let days = statement
            .query_map([limit.clamp(1, 3_660)], |row| {
                Ok(DaySummary {
                    day: row.get(0)?,
                    plays: unsigned(row.get(1)?),
                    heard_ms: unsigned(row.get(2)?),
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(days)
    }

    /// What the diary keeps, and the place it works the sun out for.
    pub fn settings(&self, now: &Now) -> Result<Settings> {
        let (plays, since) =
            self.db
                .query_row("SELECT COUNT(*), MIN(started_at) FROM plays", [], |row| {
                    Ok((row.get::<_, i64>(0)?, row.get::<_, Option<i64>>(1)?))
                })?;
        Ok(Settings {
            keep_days: self.keep_days()?,
            city: self.city()?,
            zone: now.zone.as_deref().and_then(ZoneCity::of),
            plays: u64::try_from(plays).unwrap_or_default(),
            since,
        })
    }

    /// How long plays are kept: days, or `None` for always. Letting go of
    /// older plays happens at once; returns how many went.
    pub fn set_keep_days(&mut self, days: Option<u32>, now_ms: i64) -> Result<usize> {
        if days.is_some_and(|days| !(1..=36_500).contains(&days)) {
            return Err(Error::Invalid(format!("keep {days:?} days")));
        }
        let value = days.map_or_else(|| "always".to_owned(), |days| days.to_string());
        self.set(KEEP_DAYS, &value)?;
        self.prune(now_ms)
    }

    /// Names the city the sun is worked out for; `None` goes back to the time zone.
    pub fn set_city(&mut self, city: Option<&City>) -> Result<()> {
        match city {
            Some(city) => self.set(CITY, &serde_json::to_string(city)?),
            None => {
                self.db
                    .execute("DELETE FROM settings WHERE key = ?1", [CITY])?;
                Ok(())
            }
        }
    }

    /// Lets go of plays older than the diary keeps; returns how many went.
    pub fn prune(&mut self, now_ms: i64) -> Result<usize> {
        let Some(days) = self.keep_days()? else {
            return Ok(0);
        };
        let cutoff = now_ms - i64::from(days) * DAY_MS;
        let tx = self.db.transaction()?;
        let gone = tx.execute("DELETE FROM plays WHERE started_at < ?1", [cutoff])?;
        forget_lonely_tracks(&tx)?;
        tx.commit()?;
        Ok(gone)
    }

    /// Takes one play out of the diary.
    pub fn forget(&mut self, id: i64) -> Result<()> {
        let tx = self.db.transaction()?;
        tx.execute("DELETE FROM plays WHERE id = ?1", [id])?;
        forget_lonely_tracks(&tx)?;
        tx.commit()?;
        Ok(())
    }

    /// Erases every play and track. The settings stay.
    pub fn clear(&mut self) -> Result<()> {
        let tx = self.db.transaction()?;
        tx.execute("DELETE FROM plays", [])?;
        tx.execute("DELETE FROM tracks", [])?;
        tx.commit()?;
        // Nothing of it is left in the write-ahead log either.
        self.db
            .pragma_update_and_check(None, "wal_checkpoint", "TRUNCATE", |_| Ok(()))?;
        Ok(())
    }

    fn keep_days(&self) -> Result<Option<u32>> {
        Ok(self
            .get(KEEP_DAYS)?
            .and_then(|value| value.parse::<u32>().ok()))
    }

    pub(crate) fn city(&self) -> Result<Option<City>> {
        Ok(match self.get(CITY)? {
            Some(json) => serde_json::from_str(&json).ok(),
            None => None,
        })
    }

    fn get(&self, key: &str) -> Result<Option<String>> {
        Ok(self
            .db
            .query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
                row.get(0)
            })
            .optional()?)
    }

    fn set(&mut self, key: &str, value: &str) -> Result<()> {
        self.db.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value",
            [key, value],
        )?;
        Ok(())
    }
}

/// Brings an older file up to this version's tables, step by step.
fn migrate(db: &Connection) -> Result<()> {
    let version: i32 = db.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version > SCHEMA_VERSION {
        // A newer Cloudify wrote it: better not to touch than to break it.
        return Err(Error::Newer(version));
    }
    if version < 1 {
        let tx = db.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V1)?;
        tx.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        tx.commit()?;
    }
    add_missing_columns(db)
}

/// Adds the columns an older file lacks; older versions read on without them.
fn add_missing_columns(db: &Connection) -> Result<()> {
    let mut statement = db.prepare("SELECT name FROM pragma_table_info('plays')")?;
    let present = statement
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    for (name, definition) in LATER_COLUMNS {
        if !present.iter().any(|column| column == name) {
            db.execute_batch(&format!("ALTER TABLE plays ADD COLUMN {name} {definition}"))?;
        }
    }
    Ok(())
}

/// Closes every open play as stopped where it was last heard of.
fn close_strays(db: &Connection) -> Result<usize> {
    Ok(db.execute(
        "UPDATE plays SET outcome = 'stopped', ended_at = updated_at WHERE outcome IS NULL",
        [],
    )?)
}

fn forget_lonely_tracks(db: &Connection) -> Result<()> {
    db.execute(
        "DELETE FROM tracks WHERE NOT EXISTS (SELECT 1 FROM plays WHERE plays.track = tracks.urn)",
        [],
    )?;
    Ok(())
}

/// Milliseconds as SQLite keeps them; nothing the app plays comes near the limit.
fn ms(value: u64) -> i64 {
    i64::try_from(value).unwrap_or(i64::MAX)
}

fn unsigned(value: i64) -> u64 {
    u64::try_from(value).unwrap_or_default()
}

fn parse_cursor(cursor: &str) -> Result<(i64, i64)> {
    let parsed = cursor
        .split_once(':')
        .and_then(|(at, id)| Some((at.parse().ok()?, id.parse().ok()?)));
    parsed.ok_or_else(|| Error::Invalid(format!("not a diary cursor: {cursor}")))
}

fn play_of_row(row: &Row<'_>) -> rusqlite::Result<Play> {
    let json = |index: usize| -> rusqlite::Result<Value> {
        let text: String = row.get(index)?;
        serde_json::from_str(&text).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                index,
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        })
    };
    let setting = serde_json::from_value(json(15)?).unwrap_or_default();
    Ok(Play {
        id: row.get(0)?,
        track: json(1)?,
        started_at: row.get(2)?,
        utc_offset: row.get(3)?,
        ended_at: row.get(4)?,
        outcome: row
            .get::<_, Option<String>>(5)?
            .as_deref()
            .and_then(Outcome::parse),
        from_ms: unsigned(row.get(6)?),
        position_ms: unsigned(row.get(7)?),
        listened_ms: unsigned(row.get(8)?),
        duration_ms: unsigned(row.get(9)?),
        liked: row.get(10)?,
        more: row.get(16)?,
        source: Source {
            kind: SourceKind::parse(&row.get::<_, String>(11)?),
            title: row.get(12)?,
            id: row.get::<_, Option<i64>>(13)?.map(unsigned),
        },
        added: row.get(14)?,
        setting,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setting::{PartOfDay, PlaceFrom};
    use serde_json::json;

    const MINUTE: i64 = 60_000;

    /// 4 November 2026, 19:00 in Moscow, plus `minutes`.
    fn evening(minutes: i64) -> Now {
        Now {
            utc_ms: 1_793_808_000_000 + minutes * MINUTE,
            offset_min: 180,
            zone: Some("Europe/Moscow".into()),
        }
    }

    fn track(id: u64, title: &str) -> NewPlay {
        NewPlay {
            urn: format!("soundcloud:tracks:{id}"),
            track: json!({ "id": id, "title": title, "durationMs": 200_000 }),
            duration_ms: 200_000,
            from_ms: 0,
            source: Source {
                kind: SourceKind::Likes,
                title: None,
                id: None,
            },
            added: false,
        }
    }

    fn heard(position_ms: u64, listened_ms: u64) -> Heard {
        Heard {
            position_ms,
            listened_ms,
        }
    }

    #[test]
    fn the_evening_clock_is_right() {
        // The helper's base is what it says: 19:00 MSK on Wednesday 4 November.
        let setting = Setting::at(&evening(0), None);
        assert_eq!(setting.tod, Some(PartOfDay::Evening));
        assert_eq!(evening(0).local().to_string(), "2026-11-04 19:00:00");
    }

    #[test]
    fn a_play_is_written_from_start_to_end() {
        let mut diary = Diary::open_in_memory().unwrap();
        let id = diary.start(&track(1, "Кинолента"), &evening(0)).unwrap();
        diary
            .progress(id, heard(15_000, 15_000), evening(0).utc_ms + 15_000)
            .unwrap();

        let open = &diary.plays(None, 10).unwrap().items[0];
        assert_eq!(open.outcome, None, "still playing");
        assert_eq!((open.position_ms, open.listened_ms), (15_000, 15_000));
        assert_eq!(open.track["title"], "Кинолента");

        assert!(
            diary
                .end(
                    id,
                    Outcome::Finished,
                    heard(200_000, 198_000),
                    evening(4).utc_ms
                )
                .unwrap()
        );
        let done = &diary.plays(None, 10).unwrap().items[0];
        assert_eq!(done.outcome, Some(Outcome::Finished));
        assert_eq!(done.ended_at, Some(evening(4).utc_ms));
        assert_eq!((done.position_ms, done.listened_ms), (200_000, 198_000));
        assert_eq!(done.utc_offset, 180);
        assert_eq!(done.source.kind, SourceKind::Likes);
    }

    #[test]
    fn a_closed_play_stays_as_it_ended() {
        let mut diary = Diary::open_in_memory().unwrap();
        let id = diary.start(&track(1, "АЧЧА"), &evening(0)).unwrap();
        assert!(
            diary
                .end(
                    id,
                    Outcome::Skipped,
                    heard(12_000, 12_000),
                    evening(1).utc_ms
                )
                .unwrap()
        );
        // A late report from the player changes nothing.
        assert!(
            !diary
                .end(
                    id,
                    Outcome::Finished,
                    heard(138_000, 138_000),
                    evening(3).utc_ms
                )
                .unwrap()
        );
        diary
            .progress(id, heard(90_000, 90_000), evening(2).utc_ms)
            .unwrap();
        let play = &diary.plays(None, 1).unwrap().items[0];
        assert_eq!(play.outcome, Some(Outcome::Skipped));
        assert_eq!(play.position_ms, 12_000);
    }

    #[test]
    fn heard_time_never_goes_down() {
        let mut diary = Diary::open_in_memory().unwrap();
        let id = diary.start(&track(1, "Положение"), &evening(0)).unwrap();
        diary
            .progress(id, heard(60_000, 60_000), evening(1).utc_ms)
            .unwrap();
        // Sent back to the start after a minute: it is there now, but the minute was heard.
        diary
            .progress(id, heard(2_000, 1_000), evening(2).utc_ms)
            .unwrap();
        let play = &diary.plays(None, 1).unwrap().items[0];
        assert_eq!((play.position_ms, play.listened_ms), (2_000, 60_000));
    }

    #[test]
    fn every_play_carries_the_setting_it_started_in() {
        let mut diary = Diary::open_in_memory().unwrap();
        diary.start(&track(1, "дуб OAK"), &evening(30)).unwrap();
        let setting = &diary.plays(None, 1).unwrap().items[0].setting;
        assert_eq!(setting.tod, Some(PartOfDay::Evening));
        assert_eq!(setting.daylight, Some(9.0));
        assert_eq!(setting.place, Some(PlaceFrom::Zone));

        // With no time zone known, the snapshot is still a whole object with nulls.
        let somewhere = Now {
            zone: None,
            ..evening(31)
        };
        diary.start(&track(2, "Apricots"), &somewhere).unwrap();
        let stored: String = diary
            .db
            .query_row(
                "SELECT setting FROM plays ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let stored: Value = serde_json::from_str(&stored).unwrap();
        for key in ["daylight", "sun", "weather", "activity", "mood"] {
            assert_eq!(
                stored.get(key),
                Some(&Value::Null),
                "{key} is written as null"
            );
        }
        assert_eq!(stored["tod"], "evening");
    }

    #[test]
    fn a_named_city_moves_the_sun() {
        let mut diary = Diary::open_in_memory().unwrap();
        let piter = City::new("Санкт-Петербург", 59.94, 30.31).unwrap();
        diary.set_city(Some(&piter)).unwrap();
        diary.start(&track(1, "Кинолента"), &evening(0)).unwrap();
        let setting = diary.plays(None, 1).unwrap().items[0].setting.clone();
        assert_eq!(setting.place, Some(PlaceFrom::City));
        assert_eq!(setting.lat, Some(59.9));
        // Petersburg's November day is half an hour shorter than Moscow's 9.0 h.
        assert_eq!(setting.daylight, Some(8.5));

        let settings = diary.settings(&evening(1)).unwrap();
        assert_eq!(settings.city, Some(piter));
        assert_eq!(
            settings.zone.map(|zone| zone.zone),
            Some("Europe/Moscow".into())
        );
        diary.set_city(None).unwrap();
        assert_eq!(diary.settings(&evening(1)).unwrap().city, None);
    }

    #[test]
    fn plays_page_newest_first() {
        let mut diary = Diary::open_in_memory().unwrap();
        for minute in 0..7 {
            diary
                .start(&track(minute as u64, "t"), &evening(minute))
                .unwrap();
        }
        let first = diary.plays(None, 3).unwrap();
        let times: Vec<_> = first.items.iter().map(|p| p.started_at).collect();
        assert_eq!(times, [6, 5, 4].map(|m| evening(m).utc_ms));
        let second = diary.plays(first.next.as_deref(), 3).unwrap();
        assert_eq!(second.items[0].started_at, evening(3).utc_ms);
        let last = diary.plays(second.next.as_deref(), 3).unwrap();
        assert_eq!(last.items.len(), 1);
        assert_eq!(last.next, None);
        assert!(diary.plays(Some("nonsense"), 3).is_err());
    }

    #[test]
    fn plays_started_together_are_not_lost_between_pages() {
        let mut diary = Diary::open_in_memory().unwrap();
        for id in 0..5 {
            diary.start(&track(id, "t"), &evening(0)).unwrap();
        }
        let first = diary.plays(None, 2).unwrap();
        let rest = diary.plays(first.next.as_deref(), 10).unwrap();
        assert_eq!(first.items.len() + rest.items.len(), 5);
    }

    #[test]
    fn a_track_is_kept_once_as_last_shown() {
        let mut diary = Diary::open_in_memory().unwrap();
        diary.start(&track(1, "old title"), &evening(0)).unwrap();
        diary.start(&track(1, "new title"), &evening(5)).unwrap();
        let tracks: i64 = diary
            .db
            .query_row("SELECT COUNT(*) FROM tracks", [], |row| row.get(0))
            .unwrap();
        assert_eq!(tracks, 1);
        let page = diary.plays(None, 10).unwrap();
        assert!(page.items.iter().all(|p| p.track["title"] == "new title"));
    }

    #[test]
    fn plays_left_open_are_closed_on_the_next_start() {
        let mut diary = Diary::open_in_memory().unwrap();
        let id = diary.start(&track(1, "t"), &evening(0)).unwrap();
        diary
            .progress(id, heard(30_000, 30_000), evening(1).utc_ms)
            .unwrap();
        // The app is quit here, and opened again.
        assert_eq!(diary.recover().unwrap(), 1);
        let play = &diary.plays(None, 1).unwrap().items[0];
        assert_eq!(play.outcome, Some(Outcome::Stopped));
        assert_eq!(play.ended_at, Some(evening(1).utc_ms));
        assert_eq!(play.position_ms, 30_000);
        assert_eq!(diary.recover().unwrap(), 0);
    }

    #[test]
    fn one_track_sounds_at_a_time() {
        let mut diary = Diary::open_in_memory().unwrap();
        let first = diary.start(&track(1, "t"), &evening(0)).unwrap();
        diary
            .progress(first, heard(40_000, 40_000), evening(1).utc_ms)
            .unwrap();
        // The window reloaded mid-song: the next play closes the one left open.
        let second = diary.start(&track(2, "t"), &evening(2)).unwrap();
        let page = diary.plays(None, 10).unwrap();
        let old = page.items.iter().find(|p| p.id == first).unwrap();
        assert_eq!(old.outcome, Some(Outcome::Stopped));
        assert_eq!(old.ended_at, Some(evening(1).utc_ms));
        let new = page.items.iter().find(|p| p.id == second).unwrap();
        assert_eq!(new.outcome, None);
        // «Не то» is kept as its own ending.
        assert!(
            diary
                .end(
                    second,
                    Outcome::Rejected,
                    heard(9_000, 9_000),
                    evening(3).utc_ms
                )
                .unwrap()
        );
        assert_eq!(
            diary.plays(None, 1).unwrap().items[0].outcome,
            Some(Outcome::Rejected)
        );
    }

    #[test]
    fn the_diary_keeps_as_long_as_it_is_told() {
        let mut diary = Diary::open_in_memory().unwrap();
        let day = 24 * 60;
        diary
            .start(&track(1, "long ago"), &evening(-40 * day))
            .unwrap();
        diary
            .start(&track(2, "last week"), &evening(-7 * day))
            .unwrap();
        diary.start(&track(3, "today"), &evening(0)).unwrap();
        // Always, at first.
        assert_eq!(diary.settings(&evening(0)).unwrap().keep_days, None);
        assert_eq!(diary.prune(evening(0).utc_ms).unwrap(), 0);

        assert_eq!(diary.set_keep_days(Some(30), evening(0).utc_ms).unwrap(), 1);
        let settings = diary.settings(&evening(0)).unwrap();
        assert_eq!((settings.keep_days, settings.plays), (Some(30), 2));
        assert_eq!(settings.since, Some(evening(-7 * day).utc_ms));
        // The track that played only long ago is gone with its play.
        let tracks: i64 = diary
            .db
            .query_row("SELECT COUNT(*) FROM tracks", [], |row| row.get(0))
            .unwrap();
        assert_eq!(tracks, 2);

        assert_eq!(diary.set_keep_days(None, evening(0).utc_ms).unwrap(), 0);
        assert!(diary.set_keep_days(Some(0), evening(0).utc_ms).is_err());
    }

    #[test]
    fn a_play_can_be_forgotten_and_everything_erased() {
        let mut diary = Diary::open_in_memory().unwrap();
        let first = diary.start(&track(1, "t"), &evening(0)).unwrap();
        diary.start(&track(2, "t"), &evening(1)).unwrap();
        diary.set_liked(first, true).unwrap();
        assert!(diary.plays(None, 10).unwrap().items[1].liked);
        diary.forget(first).unwrap();
        assert_eq!(diary.plays(None, 10).unwrap().items.len(), 1);
        diary.set_keep_days(Some(365), evening(1).utc_ms).unwrap();
        diary.clear().unwrap();
        let settings = diary.settings(&evening(2)).unwrap();
        assert_eq!((settings.plays, settings.since), (0, None));
        assert_eq!(settings.keep_days, Some(365), "settings outlive an erase");
    }

    #[test]
    fn the_file_survives_closing_and_a_newer_one_is_left_alone() {
        let folder = std::env::temp_dir().join(format!("cloudify-diary-{}", std::process::id()));
        let path = folder.join("diary.sqlite3");
        {
            let mut diary = Diary::open(&path).unwrap();
            diary.start(&track(1, "Кинолента"), &evening(0)).unwrap();
        }
        let diary = Diary::open(&path).unwrap();
        assert_eq!(diary.plays(None, 10).unwrap().items.len(), 1);
        diary.db.pragma_update(None, "user_version", 99).unwrap();
        drop(diary);
        assert!(matches!(Diary::open(&path), Err(Error::Newer(99))));
        std::fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn finding_reads_titles_and_artists_in_any_case() {
        let mut diary = Diary::open_in_memory().unwrap();
        let mut play = track(1, "Кинолента");
        play.track["user"] = json!({ "username": "Баста" });
        diary.start(&play, &evening(0)).unwrap();
        let mut other = track(2, "Apricots");
        other.track["user"] = json!({ "username": "Bicep" });
        diary.start(&other, &evening(1)).unwrap();
        diary.start(&track(1, "Кинолента"), &evening(2)).unwrap();

        let found = |words: &str| {
            diary
                .find(None, 50, Some(words))
                .unwrap()
                .items
                .iter()
                .map(|p| p.id)
                .collect::<Vec<_>>()
        };
        // Cyrillic in another case, and an artist's name, both find their plays.
        assert_eq!(found("КИНО"), [3, 1]);
        assert_eq!(found("bicep"), [2]);
        assert_eq!(found("нет такого"), Vec::<i64>::new());
        assert_eq!(found("  ").len(), 3, "blank words find everything");
        // Finding pages like the plain list does.
        let first = diary.find(None, 1, Some("кино")).unwrap();
        let rest = diary.find(first.next.as_deref(), 5, Some("кино")).unwrap();
        assert_eq!(
            (first.items[0].id, rest.items[0].id, rest.next),
            (3, 1, None)
        );
    }

    #[test]
    fn days_are_counted_by_the_clock_they_were_played_on() {
        let mut diary = Diary::open_in_memory().unwrap();
        let id = diary.start(&track(1, "t"), &evening(0)).unwrap();
        diary
            .end(
                id,
                Outcome::Finished,
                heard(200_000, 200_000),
                evening(4).utc_ms,
            )
            .unwrap();
        // 23:30 in Moscow is still the 4th, though it is the 4th's 20:30 in UTC…
        diary.start(&track(2, "t"), &evening(4 * 60 + 30)).unwrap();
        // …and half past midnight is the 5th.
        diary.start(&track(3, "t"), &evening(5 * 60 + 30)).unwrap();
        let days = diary.days(10).unwrap();
        assert_eq!(
            days,
            [
                DaySummary {
                    day: "2026-11-05".into(),
                    plays: 1,
                    heard_ms: 0
                },
                DaySummary {
                    day: "2026-11-04".into(),
                    plays: 2,
                    heard_ms: 200_000
                },
            ]
        );
        assert_eq!(diary.days(1).unwrap().len(), 1);
    }

    #[test]
    fn more_like_this_is_marked_and_not_this_can_be_taken_back() {
        let mut diary = Diary::open_in_memory().unwrap();
        let id = diary.start(&track(1, "Кинолента"), &evening(0)).unwrap();
        diary.set_more(id, true).unwrap();
        assert!(diary.plays(None, 1).unwrap().items[0].more);
        diary.set_more(id, false).unwrap();
        assert!(!diary.plays(None, 1).unwrap().items[0].more);

        let sent = diary.start(&track(2, "АЧЧА"), &evening(1)).unwrap();
        diary
            .end(
                sent,
                Outcome::Rejected,
                heard(7_000, 7_000),
                evening(2).utc_ms,
            )
            .unwrap();
        assert!(diary.unreject(sent).unwrap());
        let play = &diary.plays(None, 1).unwrap().items[0];
        assert_eq!(
            (play.outcome, play.position_ms),
            (Some(Outcome::Skipped), 7_000)
        );
        // Only «не то» can be taken back.
        assert!(!diary.unreject(sent).unwrap());
        assert!(!diary.unreject(id).unwrap());
    }

    #[test]
    fn a_file_from_before_more_gains_the_column_and_stays_readable_by_it() {
        let folder =
            std::env::temp_dir().join(format!("cloudify-diary-more-{}", std::process::id()));
        let path = folder.join("diary.sqlite3");
        std::fs::create_dir_all(&folder).unwrap();
        {
            // A file as the first diary wrote it: version 1, no `more`.
            let db = Connection::open(&path).unwrap();
            db.execute_batch(SCHEMA_V1).unwrap();
            db.pragma_update(None, "user_version", 1).unwrap();
        }
        let mut diary = Diary::open(&path).unwrap();
        let id = diary.start(&track(1, "Кинолента"), &evening(0)).unwrap();
        diary.set_more(id, true).unwrap();
        let version: i32 = diary
            .db
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(
            version, 1,
            "an added column does not lock older versions out"
        );
        drop(diary);
        // Opening it again adds nothing twice.
        assert!(Diary::open(&path).unwrap().plays(None, 1).unwrap().items[0].more);
        std::fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn sources_keep_their_names() {
        let mut diary = Diary::open_in_memory().unwrap();
        let mut play = track(1, "t");
        play.source = Source {
            kind: SourceKind::Playlist,
            title: Some("ночь на 14-е".into()),
            id: Some(1),
        };
        play.added = true;
        play.from_ms = 221_000;
        diary.start(&play, &evening(0)).unwrap();
        let stored = &diary.plays(None, 1).unwrap().items[0];
        assert_eq!(stored.source, play.source);
        assert!(stored.added);
        assert_eq!((stored.from_ms, stored.position_ms), (221_000, 221_000));
        // A kind from a newer version reads as «other», not as an error.
        assert_eq!(SourceKind::parse("dream"), SourceKind::Other);
        let back: Source = serde_json::from_value(json!({ "kind": "likes" })).unwrap();
        assert_eq!(back.kind, SourceKind::Likes);
    }
}
