//! What playing needs. Twins: `src/api/player.ts`.

use soundcloud::{PageRequest, Stream, Track, Waveform};
use tauri::State;

use crate::error::CommandResult;
use crate::state::AppState;

/// Tracks a station returns; SoundCloud sends about fifty whatever is asked.
const STATION_SIZE: u32 = 50;
/// Tracks like one track: the first page is enough for the selection.
const RELATED_SIZE: u32 = 50;

/// A playable stream for a track, resolved as the signed-in user (a
/// rights-restricted track refuses an anonymous caller). Short-lived: the
/// frontend asks right before playing.
#[tauri::command]
pub async fn stream(track_id: u64, state: State<'_, AppState>) -> CommandResult<Stream> {
    Ok(state.client().await.stream(track_id).await?)
}

/// The loudness outline behind a track's `waveformUrl`.
#[tauri::command]
pub async fn waveform(url: String, state: State<'_, AppState>) -> CommandResult<Waveform> {
    Ok(state.client().await.waveform(&url).await?)
}

/// SoundCloud's radio from a track: the selection's source of new music.
#[tauri::command]
pub async fn track_station(track_id: u64, state: State<'_, AppState>) -> CommandResult<Vec<Track>> {
    Ok(state
        .client()
        .await
        .track_station(track_id, STATION_SIZE)
        .await?)
}

/// SoundCloud's radio from an artist: their tracks and music like them.
#[tauri::command]
pub async fn artist_station(user_id: u64, state: State<'_, AppState>) -> CommandResult<Vec<Track>> {
    Ok(state
        .client()
        .await
        .artist_station(user_id, STATION_SIZE)
        .await?)
}

/// Tracks like one track (what powers SoundCloud's autoplay): the selection's
/// second source of new music, beside the radio.
#[tauri::command]
pub async fn related_tracks(
    track_id: u64,
    state: State<'_, AppState>,
) -> CommandResult<Vec<Track>> {
    Ok(state
        .client()
        .await
        .related_tracks(track_id, PageRequest::first(RELATED_SIZE))
        .await?
        .items)
}
