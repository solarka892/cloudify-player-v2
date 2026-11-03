//! The signed-in user's library. Twins: `src/api/library.ts`.

use soundcloud::{LikedTrack, Page, PageRequest, PlayedTrack, Playlist};
use tauri::State;

use crate::error::CommandResult;
use crate::state::AppState;

/// Liked tracks, latest like first. `None` is the first page at full size.
#[tauri::command]
pub async fn my_likes(
    page: Option<PageRequest>,
    state: State<'_, AppState>,
) -> CommandResult<Page<LikedTrack>> {
    let client = state.client().await;
    let me = client.my_user_id().await?;
    Ok(client
        .user_liked_tracks(me, page.unwrap_or_default())
        .await?)
}

/// The user's own playlists, albums left out (they get their own list).
#[tauri::command]
pub async fn my_playlists(
    page: Option<PageRequest>,
    state: State<'_, AppState>,
) -> CommandResult<Page<Playlist>> {
    let client = state.client().await;
    let me = client.my_user_id().await?;
    Ok(client.user_playlists(me, page.unwrap_or_default()).await?)
}

/// What was played on SoundCloud, latest first.
#[tauri::command]
pub async fn play_history(
    page: Option<PageRequest>,
    state: State<'_, AppState>,
) -> CommandResult<Page<PlayedTrack>> {
    let client = state.client().await;
    Ok(client.play_history(page.unwrap_or_default()).await?)
}

/// One playlist with every track, complete and in order.
#[tauri::command]
pub async fn playlist(id: u64, state: State<'_, AppState>) -> CommandResult<Playlist> {
    Ok(state.client().await.playlist(id).await?)
}
