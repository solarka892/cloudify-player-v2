import { create } from "zustand";
import type { Track } from "@/api/types";
import { loadResumePoint } from "@/features/player/resume";

/** Where the queue came from; the player bar names it under the title. */
export type QueueSource =
  | { kind: "selection" }
  | { kind: "likes" }
  | { kind: "playlist"; title: string; id?: number }
  | { kind: "history" }
  | { kind: "reposts" }
  | { kind: "artist"; title: string }
  | { kind: "station"; title: string }
  | { kind: "search"; title: string };

export type SkipReason = "skip" | "dislike" | "ended" | "unavailable";

export interface QueueOptions {
  /** Seconds into the first track (resuming where it stopped). */
  startAt?: number;
  /** An endless queue extends itself: more tracks, none of `exclude`. */
  refill?: (exclude: ReadonlySet<number>) => Track[];
  /** Told about every track left early, so the source can learn from it. */
  onSkip?: (track: Track, reason: SkipReason, position: number) => void;
}

interface PlayerState {
  queue: Track[];
  index: number;
  source: QueueSource | null;
  /** The person wants sound. The engine follows; `buffering` says it has not caught up yet. */
  playing: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  /** One honest line about what just happened; the player bar shows it for a while. */
  notice: string | null;
  /** A way to take back what the notice reports («Вернуть»), when there is one. */
  noticeAction: { label: string; run: () => void } | null;
  /** Bumped whenever the current track must be (re)loaded from `startAt`. */
  loadId: number;
  startAt: number;
  /** Bumped to make the engine jump to `position`. */
  seekId: number;
  options: QueueOptions;

  playQueue: (tracks: Track[], index: number, source: QueueSource, options?: QueueOptions) => void;
  toggle: () => void;
  setPlaying: (playing: boolean) => void;
  next: (reason?: SkipReason) => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  /** Swaps everything after the current track (a mood changed). */
  replaceUpcoming: (tracks: Track[]) => void;
  /** Puts a track right after the current one; with nothing playing, plays it. */
  playNext: (track: Track, source: QueueSource) => void;
  say: (notice: string | null, action?: { label: string; run: () => void }) => void;
  /** Reports from the audio engine. */
  report: (patch: Partial<Pick<PlayerState, "position" | "duration" | "buffering">>) => void;
  stop: () => void;
}

const VOLUME_KEY = "cloudify.volume";

function savedVolume(): number {
  try {
    const value = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(value) && value > 0 && value <= 1 ? value : 0.8;
  } catch {
    return 0.8;
  }
}

/** After a restart the last track waits, paused, where it stopped. */
function restored(): Pick<
  PlayerState,
  "queue" | "index" | "source" | "position" | "duration" | "startAt"
> {
  const point = loadResumePoint();
  if (!point) {
    return { queue: [], index: -1, source: null, position: 0, duration: 0, startAt: 0 };
  }
  return {
    queue: [point.track],
    index: 0,
    source: { kind: "history" },
    position: point.position,
    duration: point.track.durationMs / 1000,
    startAt: point.position,
  };
}

export const usePlayer = create<PlayerState>()((set, get) => ({
  ...restored(),
  playing: false,
  buffering: false,
  volume: savedVolume(),
  muted: false,
  notice: null,
  noticeAction: null,
  loadId: 0,
  seekId: 0,
  options: {},

  playQueue: (tracks, index, source, options = {}) => {
    const track = tracks[index];
    if (!track) return;
    const startAt = options.startAt ?? 0;
    set((s) => ({
      queue: tracks,
      index,
      source,
      options,
      playing: true,
      position: startAt,
      duration: track.durationMs / 1000,
      startAt,
      notice: null,
      loadId: s.loadId + 1,
    }));
  },

  toggle: () => {
    const { index, playing } = get();
    if (index < 0) return;
    set({ playing: !playing });
  },

  setPlaying: (playing) => {
    if (get().index < 0) return;
    set({ playing });
  },

  next: (reason = "skip") => {
    const { queue, index, options, position } = get();
    const current = queue[index];
    if (current && reason !== "ended") options.onSkip?.(current, reason, position);
    let upcoming = queue;
    if (index + 1 >= queue.length && options.refill) {
      const more = options.refill(new Set(queue.map((t) => t.id)));
      upcoming = [...queue, ...more];
    }
    const nextTrack = upcoming[index + 1];
    if (!nextTrack) {
      set({ queue: upcoming, playing: false, position: 0, startAt: 0 });
      return;
    }
    set((s) => ({
      queue: upcoming,
      index: index + 1,
      playing: true,
      position: 0,
      duration: nextTrack.durationMs / 1000,
      startAt: 0,
      loadId: s.loadId + 1,
    }));
  },

  previous: () => {
    const { index, position, queue } = get();
    if (index < 0) return;
    const previousTrack = queue[index - 1];
    if (position > 3 || !previousTrack) {
      get().seek(0);
      return;
    }
    set((s) => ({
      index: index - 1,
      playing: true,
      position: 0,
      duration: previousTrack.durationMs / 1000,
      startAt: 0,
      loadId: s.loadId + 1,
    }));
  },

  seek: (seconds) => {
    const { duration, index } = get();
    if (index < 0) return;
    const position = Math.max(0, Math.min(seconds, duration || seconds));
    set((s) => ({ position, startAt: position, seekId: s.seekId + 1 }));
  },

  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ volume: clamped, muted: clamped === 0 });
    try {
      if (clamped > 0) localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      // Private storage unavailable: the volume just won't survive a restart.
    }
  },

  toggleMute: () => {
    const { muted, volume } = get();
    if (muted && volume === 0) set({ volume: savedVolume(), muted: false });
    else set({ muted: !muted });
  },

  replaceUpcoming: (tracks) => {
    const { queue, index } = get();
    const current = queue[index];
    if (!current) return;
    set({ queue: [...queue.slice(0, index + 1), ...tracks.filter((t) => t.id !== current.id)] });
  },

  playNext: (track, source) => {
    const { queue, index } = get();
    if (index < 0 || !queue[index]) {
      get().playQueue([track], 0, source);
      return;
    }
    const rest = queue.slice(index + 1).filter((t) => t.id !== track.id);
    set({
      queue: [...queue.slice(0, index + 1), track, ...rest],
      notice: `Дальше: ${track.title}`,
      noticeAction: null,
    });
  },

  say: (notice, action) => set({ notice, noticeAction: action ?? null }),

  report: (patch) => set(patch),

  stop: () =>
    set((s) => ({
      queue: [],
      index: -1,
      source: null,
      options: {},
      playing: false,
      buffering: false,
      position: 0,
      duration: 0,
      startAt: 0,
      notice: null,
      loadId: s.loadId + 1,
    })),
}));

export function currentTrack(state: { queue: Track[]; index: number }): Track | null {
  return state.queue[state.index] ?? null;
}
