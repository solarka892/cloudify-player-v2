//! Other people on SoundCloud. Twins: `src/api/people.ts`.

use soundcloud::{Page, PageRequest, Track};
use tauri::State;

use crate::error::CommandResult;
use crate::state::AppState;

/// An artist's most played tracks, most played first.
#[tauri::command]
pub async fn artist_top_tracks(
    user_id: u64,
    page: Option<PageRequest>,
    state: State<'_, AppState>,
) -> CommandResult<Page<Track>> {
    Ok(state
        .client()
        .await
        .user_top_tracks(user_id, page.unwrap_or_default())
        .await?)
}
