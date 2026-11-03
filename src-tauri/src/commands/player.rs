//! What playing needs. Twins: `src/api/player.ts`.

use soundcloud::{Stream, Track, Waveform};
use tauri::State;

use crate::error::CommandResult;
use crate::state::AppState;

/// Tracks a station returns; SoundCloud sends about fifty whatever is asked.
const STATION_SIZE: u32 = 50;

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
