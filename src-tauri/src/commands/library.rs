//! The signed-in user's library. Twins: `src/api/library.ts`.

use soundcloud::{
    LikedPlaylist, LikedTrack, Page, PageRequest, PlayedTrack, Playlist, Repost, User,
};
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

/// The user's own albums.
#[tauri::command]
pub async fn my_albums(
    page: Option<PageRequest>,
    state: State<'_, AppState>,
) -> CommandResult<Page<Playlist>> {
    let client = state.client().await;
    let me = client.my_user_id().await?;
    Ok(client.user_albums(me, page.unwrap_or_default()).await?)
}

/// Playlists and albums the user liked, latest like first; `isAlbum` tells them apart.
#[tauri::command]
pub async fn my_liked_playlists(
    page: Option<PageRequest>,
    state: State<'_, AppState>,
) -> CommandResult<Page<LikedPlaylist>> {
    let client = state.client().await;
    let me = client.my_user_id().await?;
    Ok(client
        .user_liked_playlists(me, page.unwrap_or_default())
        .await?)
}

/// Tracks and playlists the user reposted, latest first.
#[tauri::command]
pub async fn my_reposts(
    page: Option<PageRequest>,
    state: State<'_, AppState>,
) -> CommandResult<Page<Repost>> {
    let client = state.client().await;
    let me = client.my_user_id().await?;
    Ok(client.user_reposts(me, page.unwrap_or_default()).await?)
}

/// The people the user follows.
#[tauri::command]
pub async fn my_followings(
    page: Option<PageRequest>,
    state: State<'_, AppState>,
) -> CommandResult<Page<User>> {
    let client = state.client().await;
    let me = client.my_user_id().await?;
    Ok(client.user_followings(me, page.unwrap_or_default()).await?)
}

/// Likes a track. SoundCloud's bot filter may refuse it; that comes back as
/// `bot-filtered`, never as success.
#[tauri::command]
pub async fn like_track(track_id: u64, state: State<'_, AppState>) -> CommandResult<()> {
    Ok(state.client().await.like_track(track_id).await?)
}

/// Takes a like back. Refused the same way a like can be.
#[tauri::command]
pub async fn unlike_track(track_id: u64, state: State<'_, AppState>) -> CommandResult<()> {
    Ok(state.client().await.unlike_track(track_id).await?)
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
