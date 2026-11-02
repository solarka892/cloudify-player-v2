//! The Tauri shell: windows, state and the commands the frontend calls.
//! Talking to SoundCloud lives in the `soundcloud` crate, not here.

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::app::app_info])
        .run(tauri::generate_context!())
        .expect("Cloudify failed to start");
}
