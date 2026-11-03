import { isTauri } from "@/api/app";

/**
 * On macOS the window has no title bar: the system's close / minimise / zoom
 * buttons sit inside our own top bar (see `tauri.conf.json`), so the bar keeps
 * room for them. Elsewhere, and in a plain browser tab, it does not.
 */
export const roomForTrafficLights = isTauri() && /Mac/.test(navigator.userAgent);
