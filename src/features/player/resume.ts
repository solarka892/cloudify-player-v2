import type { Track } from "@/api/types";

// Where the last track stopped, so the app can pick it up after a restart.
// Kept in the window's local storage until the app has its own database.

const KEY = "cloudify.resume";

export interface ResumePoint {
  track: Track;
  /** Seconds into the track. */
  position: number;
  savedAt: string;
}

export function loadResumePoint(): ResumePoint | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const point = JSON.parse(raw) as Partial<ResumePoint>;
    if (!point.track || typeof point.track.id !== "number" || typeof point.position !== "number") {
      return null;
    }
    return { track: point.track, position: point.position, savedAt: point.savedAt ?? "" };
  } catch {
    return null;
  }
}

export function saveResumePoint(track: Track, position: number) {
  // Nearly finished counts as finished: nothing to resume.
  const left = track.durationMs / 1000 - position;
  try {
    if (left < 10) localStorage.removeItem(KEY);
    else {
      const point: ResumePoint = { track, position, savedAt: new Date().toISOString() };
      localStorage.setItem(KEY, JSON.stringify(point));
    }
  } catch {
    // Storage unavailable: resuming just won't work this time.
  }
}

export function forgetResumePoint() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}
