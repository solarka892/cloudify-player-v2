// Tracks the selection must not offer again: «не то», or skipped within the
// first half-minute. Kept in the window's local storage until the app has its
// own database (the listening diary).

const KEY = "cloudify.selection.skipped";
const LIMIT = 3000;
/** Leaving a track this early counts as "not for me". */
export const EARLY_SKIP_SECONDS = 30;

let cache: Set<number> | null = null;

export function skippedTracks(): ReadonlySet<number> {
  if (!cache) {
    try {
      const ids: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      cache = new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "number") : []);
    } catch {
      cache = new Set();
    }
  }
  return cache;
}

export function rememberSkip(trackId: number) {
  const ids = new Set(skippedTracks());
  ids.delete(trackId);
  ids.add(trackId);
  const kept = [...ids].slice(-LIMIT);
  cache = new Set(kept);
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    // Storage unavailable: the skip still counts for this run.
  }
}
