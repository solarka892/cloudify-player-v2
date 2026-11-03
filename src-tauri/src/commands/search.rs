//! Search on SoundCloud. Twins: `src/api/search.ts`.
//!
//! Search is offset-paged: each page says where the next one starts
//! (`nextOffset`), and a blank query is refused before anything is sent.

use soundcloud::{
    GenreCount, OffsetRequest, Playlist, Resource, SearchPage, Suggestion, Track, TrackFilters,
    User,
};
use tauri::State;

use crate::error::CommandResult;
use crate::state::AppState;

/// Everything at once — tracks, people, playlists — in SoundCloud's own order.
#[tauri::command]
pub async fn search_all(
    query: String,
    page: Option<OffsetRequest>,
    state: State<'_, AppState>,
) -> CommandResult<SearchPage<Resource>> {
    Ok(state
        .client()
        .await
        .search(&query, page.unwrap_or_default())
        .await?)
}

/// Tracks, narrowed by the filters (none narrows nothing).
#[tauri::command]
pub async fn search_tracks(
    query: String,
    filters: Option<TrackFilters>,
    page: Option<OffsetRequest>,
    state: State<'_, AppState>,
) -> CommandResult<SearchPage<Track>> {
    Ok(state
        .client()
        .await
        .search_tracks(
            &query,
            &filters.unwrap_or_default(),
            page.unwrap_or_default(),
        )
        .await?)
}

/// The genres among the tracks found, most tracks first, counted with the
/// other filters but not the genre.
#[tauri::command]
pub async fn search_track_genres(
    query: String,
    filters: Option<TrackFilters>,
    state: State<'_, AppState>,
) -> CommandResult<Vec<GenreCount>> {
    Ok(state
        .client()
        .await
        .search_track_genres(&query, &filters.unwrap_or_default())
        .await?)
}

/// People: artists, labels, listeners.
#[tauri::command]
pub async fn search_users(
    query: String,
    page: Option<OffsetRequest>,
    state: State<'_, AppState>,
) -> CommandResult<SearchPage<User>> {
    Ok(state
        .client()
        .await
        .search_users(&query, page.unwrap_or_default())
        .await?)
}

/// Playlists, albums included (`isAlbum` tells them apart).
#[tauri::command]
pub async fn search_playlists(
    query: String,
    page: Option<OffsetRequest>,
    state: State<'_, AppState>,
) -> CommandResult<SearchPage<Playlist>> {
    Ok(state
        .client()
        .await
        .search_playlists(&query, page.unwrap_or_default())
        .await?)
}

/// Albums only.
#[tauri::command]
pub async fn search_albums(
    query: String,
    page: Option<OffsetRequest>,
    state: State<'_, AppState>,
) -> CommandResult<SearchPage<Playlist>> {
    Ok(state
        .client()
        .await
        .search_albums(&query, page.unwrap_or_default())
        .await?)
}

/// What people search for that starts like this, while typing. A blank
/// query has none (and asks nothing).
#[tauri::command]
pub async fn search_suggestions(
    query: String,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> CommandResult<Vec<Suggestion>> {
    Ok(state
        .client()
        .await
        .autocomplete(&query, limit.unwrap_or(8))
        .await?)
}
