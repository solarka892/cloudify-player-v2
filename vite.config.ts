import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Set by `tauri android dev` / `tauri ios dev` so a phone can reach the dev server.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Keep Rust compiler errors on screen instead of clearing them away.
  clearScreen: false,
  server: {
    // Tauri loads the app from this exact port.
    port: 1420,
    strictPort: true,
    host: host ?? false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**", "**/crates/**", "**/target/**"] },
  },
  build: {
    // The webviews Tauri ships on: WKWebView (macOS), WebView2 (Windows), WebKitGTK (Linux).
    target: ["safari16", "chrome110"],
  },
});
