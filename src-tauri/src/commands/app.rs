use serde::Serialize;

/// Mirrored by `AppInfo` in `src/api/app.ts`.
#[derive(Debug, Serialize)]
pub struct AppInfo {
    name: String,
    version: String,
}

#[tauri::command]
pub fn app_info(app: tauri::AppHandle) -> AppInfo {
    let package = app.package_info();
    AppInfo {
        name: package.name.clone(),
        version: package.version.to_string(),
    }
}
