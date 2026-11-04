//! The listening diary: the player writes plays, the «Дневник» screen reads
//! them. Everything stays in a file on this computer. Twins: `src/api/diary.ts`.

use diary::{City, Diary, Heard, NewPlay, Now, Outcome, Page, Settings, Source};
use serde::Deserialize;
use soundcloud::Track;
use tauri::State;

use crate::diary_file::DiaryState;
use crate::error::{CommandError, CommandResult};

/// Plays per page when the screen does not say.
const PAGE: u32 = 200;

/// A play whose sound has just started. Mirrored by `StartPlay` in `src/api/diary.ts`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartPlay {
    track: Track,
    source: Source,
    /// Put next by hand («Играть следующим»).
    #[serde(default)]
    added: bool,
    /// Where in the track the sound began, in milliseconds.
    #[serde(default)]
    from_ms: u64,
}

/// A city the person names, as the screen's list has it.
#[derive(Debug, Deserialize)]
pub struct CityChoice {
    name: String,
    lat: f64,
    lon: f64,
}

/// Writes down a play whose sound has just started, with the setting it
/// starts in; returns the play's id for the calls that follow.
#[tauri::command]
pub async fn diary_start(play: StartPlay, diary: State<'_, DiaryState>) -> CommandResult<i64> {
    let now = Now::system();
    let mut track = play.track;
    // The description can run to pages, and the diary never shows it.
    track.description = None;
    let new = NewPlay {
        urn: track.urn.clone(),
        duration_ms: track.duration_ms,
        track: serde_json::to_value(&track)
            .map_err(|error| CommandError::Storage(error.to_string()))?,
        from_ms: play.from_ms,
        source: play.source,
        added: play.added,
    };
    diary.with(move |diary| diary.start(&new, &now)).await
}

/// How far a play has got: where it is and how much was really heard.
#[tauri::command]
pub async fn diary_progress(
    id: i64,
    heard: Heard,
    diary: State<'_, DiaryState>,
) -> CommandResult<()> {
    let now = Now::system().utc_ms;
    diary
        .with(move |diary| diary.progress(id, heard, now))
        .await
}

/// Closes a play with how it ended. A play already closed stays as it was.
#[tauri::command]
pub async fn diary_end(
    id: i64,
    outcome: Outcome,
    heard: Heard,
    diary: State<'_, DiaryState>,
) -> CommandResult<()> {
    let now = Now::system().utc_ms;
    diary
        .with(move |diary| diary.end(id, outcome, heard, now).map(|_| ()))
        .await
}

/// The track was liked, or the like taken back, while this play went on.
#[tauri::command]
pub async fn diary_liked(id: i64, liked: bool, diary: State<'_, DiaryState>) -> CommandResult<()> {
    diary.with(move |diary| diary.set_liked(id, liked)).await
}

/// Plays, newest first; `before` is the `next` of the page before.
#[tauri::command]
pub async fn diary_plays(
    before: Option<String>,
    limit: Option<u32>,
    diary: State<'_, DiaryState>,
) -> CommandResult<Page> {
    diary
        .with(move |diary| diary.plays(before.as_deref(), limit.unwrap_or(PAGE)))
        .await
}

/// How long plays are kept, the place the sun is worked out for, and how much is kept.
#[tauri::command]
pub async fn diary_settings(diary: State<'_, DiaryState>) -> CommandResult<Settings> {
    let now = Now::system();
    diary.with(move |diary| diary.settings(&now)).await
}

/// Keeps plays this many days (`None`: always); older ones go at once.
/// Returns how many went.
#[tauri::command]
pub async fn diary_keep(days: Option<u32>, diary: State<'_, DiaryState>) -> CommandResult<usize> {
    let now = Now::system().utc_ms;
    diary
        .with(move |diary| diary.set_keep_days(days, now))
        .await
}

/// Names the city the sun is worked out for; `None` goes back to the time zone.
#[tauri::command]
pub async fn diary_city(
    city: Option<CityChoice>,
    diary: State<'_, DiaryState>,
) -> CommandResult<()> {
    let city = match city {
        Some(choice) => Some(
            City::new(&choice.name, choice.lat, choice.lon)
                .ok_or_else(|| CommandError::App(format!("not a city: {}", choice.name)))?,
        ),
        None => None,
    };
    diary.with(move |diary| diary.set_city(city.as_ref())).await
}

/// Takes one play out of the diary.
#[tauri::command]
pub async fn diary_forget(id: i64, diary: State<'_, DiaryState>) -> CommandResult<()> {
    diary.with(move |diary| diary.forget(id)).await
}

/// Erases every play. How long to keep and the city stay as they were.
#[tauri::command]
pub async fn diary_clear(diary: State<'_, DiaryState>) -> CommandResult<()> {
    diary.with(Diary::clear).await
}
