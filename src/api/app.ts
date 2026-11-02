import { invoke } from "@tauri-apps/api/core";

/** What the Rust side reports about itself. Mirrors `commands::app::AppInfo`. */
export interface AppInfo {
  name: string;
  version: string;
}

export function appInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
}

/** True inside the Tauri window, false in a plain browser tab (e.g. `pnpm dev`). */
export function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}
