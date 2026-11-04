//! The listening diary: the player writes plays, the «Дневник» screen reads
//! them. Everything stays in a file on this computer. Twins: `src/api/diary.ts`.

use diary::{City, DaySummary, Diary, Heard, NewPlay, Now, Outcome, Page, Settings, Source};
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

/// Plays, newest first; `before` is the `next` of the page before. With
/// `find`, only the plays of tracks whose title or artist holds those words.
#[tauri::command]
pub async fn diary_plays(
    before: Option<String>,
    limit: Option<u32>,
    find: Option<String>,
    diary: State<'_, DiaryState>,
) -> CommandResult<Page> {
    diary
        .with(move |diary| diary.find(before.as_deref(), limit.unwrap_or(PAGE), find.as_deref()))
        .await
}

/// The latest days with plays, newest first: how much was played on each.
#[tauri::command]
pub async fn diary_days(
    limit: Option<u32>,
    diary: State<'_, DiaryState>,
) -> CommandResult<Vec<DaySummary>> {
    diary
        .with(move |diary| diary.days(limit.unwrap_or(31)))
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

#[cfg(test)]
mod tests {
    use super::*;
    use diary::SourceKind;
    use serde_json::json;

    /// A track the way the frontend holds it (Rust's own camelCase JSON) and sends it back.
    fn track() -> serde_json::Value {
        json!({
            "id": 935029318, "urn": "soundcloud:tracks:935029318", "title": "Положение",
            "permalinkUrl": null, "artworkUrl": null, "durationMs": 282000, "fullDurationMs": 282000,
            "user": {
                "id": 15, "urn": "soundcloud:users:15", "username": "Скриптонит", "fullName": null,
                "permalinkUrl": null, "avatarUrl": null, "bannerUrl": null, "description": null,
                "city": null, "countryCode": null, "followersCount": null, "followingsCount": null,
                "trackCount": null, "playlistCount": null, "likesCount": null, "verified": false
            },
            "genre": "Hip-hop", "tags": [], "description": "a long text", "createdAt": null,
            "playbackCount": null, "likesCount": null, "repostsCount": null, "commentCount": null,
            "waveformUrl": null,
            "access": {
                "policy": "allow", "monetization": "not-applicable", "goPlus": false,
                "preview": false, "playable": true
            },
            "downloadable": false, "license": null, "labelName": null, "purchaseUrl": null,
            "purchaseTitle": null, "private": false
        })
    }

    #[test]
    fn a_play_from_the_frontend_reads_as_sent() {
        let play: StartPlay = serde_json::from_value(json!({
            "track": track(),
            "source": { "kind": "diary", "title": "вечер 3 ноября", "id": null },
            "added": true,
            "fromMs": 120000
        }))
        .unwrap();
        assert_eq!(play.track.urn, "soundcloud:tracks:935029318");
        assert_eq!(play.source.kind, SourceKind::Diary);
        assert_eq!((play.added, play.from_ms), (true, 120_000));
        // What the pen sends when nothing was added by hand and it starts at the top.
        let plain: StartPlay = serde_json::from_value(json!({
            "track": track(),
            "source": { "kind": "resume", "title": null, "id": null },
            "added": false,
            "fromMs": 0
        }))
        .unwrap();
        assert_eq!(plain.source.kind, SourceKind::Resume);
        let heard: Heard =
            serde_json::from_value(json!({ "positionMs": 12000, "listenedMs": 11000 })).unwrap();
        assert_eq!((heard.position_ms, heard.listened_ms), (12_000, 11_000));
        let outcome: Outcome = serde_json::from_value(json!("rejected")).unwrap();
        assert_eq!(outcome, Outcome::Rejected);
    }
}
