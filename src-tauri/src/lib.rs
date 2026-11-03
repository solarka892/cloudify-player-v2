//! The Tauri shell: windows, state and the commands the frontend calls.
//! Talking to SoundCloud lives in the `soundcloud` crate, not here.

mod commands;
mod error;
mod keychain;
mod signin;
mod state;

use tauri::{Manager, WindowEvent};

use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState::new().expect("Cloudify could not set up its connection to SoundCloud");
    tauri::Builder::default()
        .manage(state)
        .setup(|app| {
            // Find the `client_id` now, so the first real request does not wait for it.
            let client = app.state::<AppState>().client_unsigned();
            tauri::async_runtime::spawn(async move {
                if let Err(error) = client.warm_up().await {
                    eprintln!("cloudify: SoundCloud is not reachable yet: {error}");
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            // The sign-in window must not outlive the app's own window.
            if window.label() == "main"
                && matches!(event, WindowEvent::Destroyed)
                && let Some(signin) = window.app_handle().get_webview_window(signin::LABEL)
            {
                let _ = signin.close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::app_info,
            commands::session::session,
            commands::session::sign_in_with_window,
            commands::session::sign_in_with_token,
            commands::session::sign_out,
            commands::library::my_likes,
            commands::library::my_playlists,
            commands::library::my_albums,
            commands::library::my_liked_playlists,
            commands::library::my_reposts,
            commands::library::my_followings,
            commands::library::play_history,
            commands::library::playlist,
            commands::people::artist_top_tracks,
            commands::player::stream,
            commands::player::waveform,
            commands::player::track_station,
            commands::player::artist_station,
        ])
        .run(tauri::generate_context!())
        .expect("Cloudify failed to start");
}
