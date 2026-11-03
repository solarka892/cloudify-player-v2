//! Every `#[tauri::command]` the frontend can call, grouped by area.
//! Each one has a typed twin in `src/api/`.

pub mod app;
pub mod library;
pub mod people;
pub mod player;
pub mod session;
