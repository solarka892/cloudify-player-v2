import { create } from "zustand";
import type { Track } from "@/api/types";
import {
  entry,
  extend,
  insertNext,
  moveBefore,
  moveBy,
  putBack,
  type QueueEntry,
  type QueueOrder,
  replaceAhead,
  shuffleOff,
  shuffleOn,
  startOrder,
  without,
} from "@/features/player/queue";
import { loadResumePoint } from "@/features/player/resume";
import { formatCount, plural } from "@/ui/format";

export type { QueueEntry } from "@/features/player/queue";

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

/** Off; the whole queue round and round; one track over and over. */
export type Repeat = "off" | "all" | "one";

export interface QueueOptions {
  /** Seconds into the first track (resuming where it stopped). */
  startAt?: number;
  /** Starts in a fresh random order from the chosen track; shuffle off brings the list's own order back. */
  shuffle?: boolean;
  /** An endless queue extends itself: more tracks, none of `exclude`. */
  refill?: (exclude: ReadonlySet<number>) => Track[];
  /** Told about every track left early, so the source can learn from it. */
  onSkip?: (track: Track, reason: SkipReason, position: number) => void;
}

interface PlayerState extends QueueOrder {
  queue: readonly QueueEntry[];
  source: QueueSource | null;
  /** Keys of the entries that have played in this queue: a shuffle leaves them behind. */
  heard: ReadonlySet<number>;
  /** Kept across queues and restarts, like the volume. */
  repeat: Repeat;
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
  /** Plays the entry with this key; the playing one pauses or goes on instead. */
  jump: (key: number) => void;
  /** Takes an upcoming entry out, with «Вернуть». */
  remove: (key: number) => void;
  /** Takes out everything after the playing track, with «Вернуть». */
  clearAhead: () => void;
  /** Moves an upcoming entry to just before another one (to the end with `null`). */
  move: (key: number, beforeKey: number | null) => void;
  /** One place up or down; `false` at either end of what is ahead. */
  moveBy: (key: number, step: 1 | -1) => boolean;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  /** Swaps everything after the current track (a mood changed); what the person added stays. */
  replaceUpcoming: (tracks: Track[]) => void;
  /** The list the queue came from has grown: its new tracks join the queue. */
  extendSource: (tracks: Track[]) => void;
  /** Puts a track right after the current one; with nothing playing, plays it. */
  playNext: (track: Track, source: QueueSource) => void;
  say: (notice: string | null, action?: { label: string; run: () => void }) => void;
  /** Reports from the audio engine. */
  report: (patch: Partial<Pick<PlayerState, "position" | "duration" | "buffering">>) => void;
  stop: () => void;
}

const VOLUME_KEY = "cloudify.volume";
const REPEAT_KEY = "cloudify.repeat";
const REPEATS: readonly Repeat[] = ["off", "all", "one"];

function savedVolume(): number {
  try {
    const value = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(value) && value > 0 && value <= 1 ? value : 0.8;
  } catch {
    return 0.8;
  }
}

function savedRepeat(): Repeat {
  try {
    const value = localStorage.getItem(REPEAT_KEY);
    return REPEATS.find((r) => r === value) ?? "off";
  } catch {
    return "off";
  }
}

const tracksWord = (n: number) => `${formatCount(n)} ${plural(n, ["трек", "трека", "треков"])}`;

/** «Вернул порядок …»: whose order came back. */
function orderOf(source: QueueSource | null): string {
  switch (source?.kind) {
    case "likes":
      return "лайков";
    case "playlist":
      return `«${source.title}»`;
    case "reposts":
      return "репостов";
    case "history":
      return "истории";
    case "artist":
      return "популярного";
    case "station":
      return "радио";
    case "search":
      return "поиска";
    default:
      return "списка";
  }
}

/** After a restart the last track waits, paused, where it stopped. */
function restored(): Pick<
  PlayerState,
  "queue" | "index" | "original" | "heard" | "source" | "position" | "duration" | "startAt"
> {
  const point = loadResumePoint();
  if (!point) {
    return {
      queue: [],
      index: -1,
      original: null,
      heard: new Set(),
      source: null,
      position: 0,
      duration: 0,
      startAt: 0,
    };
  }
  const first = entry(point.track);
  return {
    queue: [first],
    index: 0,
    original: null,
    heard: new Set([first.key]),
    source: { kind: "history" },
    position: point.position,
    duration: point.track.durationMs / 1000,
    startAt: point.position,
  };
}

export const usePlayer = create<PlayerState>()((set, get) => {
  /** Makes `index` of `queue` the playing entry, from its start. */
  const playAt = (queue: readonly QueueEntry[], index: number) => {
    const now = queue[index];
    if (!now) return;
    set((s) => ({
      queue,
      index,
      playing: true,
      position: 0,
      duration: now.track.durationMs / 1000,
      startAt: 0,
      heard: new Set(s.heard).add(now.key),
      loadId: s.loadId + 1,
    }));
  };

  /** Reports an entry left early, so an endless source can learn from it. */
  const leaving = (reason: SkipReason) => {
    const { queue, index, options, position } = get();
    const now = queue[index];
    if (now && reason !== "ended") options.onSkip?.(now.track, reason, position);
  };

  return {
    ...restored(),
    repeat: savedRepeat(),
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
      const order = startOrder(tracks, index, options.shuffle ?? false);
      const now = order.queue[order.index];
      if (!now) return;
      const startAt = options.startAt ?? 0;
      set((s) => ({
        ...order,
        heard: new Set([now.key]),
        source,
        options,
        playing: true,
        position: startAt,
        duration: now.track.durationMs / 1000,
        startAt,
        notice: null,
        noticeAction: null,
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
      const { queue, index, options, repeat } = get();
      if (index < 0) return;
      if (reason === "ended" && repeat === "one") {
        // The same track again, from the top: a fresh load, as if it had just been chosen.
        set((s) => ({ position: 0, startAt: 0, playing: true, loadId: s.loadId + 1 }));
        return;
      }
      leaving(reason);
      let upcoming = queue;
      if (index + 1 >= queue.length && options.refill) {
        const more = options.refill(new Set(queue.map((e) => e.track.id)));
        upcoming = [...queue, ...more.map((track) => entry(track))];
      }
      if (index + 1 < upcoming.length) {
        playAt(upcoming, index + 1);
        return;
      }
      if (repeat === "all" && upcoming.length > 0) {
        playAt(upcoming, 0);
        return;
      }
      set({
        queue: upcoming,
        playing: false,
        position: 0,
        startAt: 0,
        ...(reason === "ended" ? { notice: "Очередь доиграла", noticeAction: null } : {}),
      });
    },

    previous: () => {
      const { index, position, queue } = get();
      if (index < 0) return;
      if (position > 3 || !queue[index - 1]) {
        get().seek(0);
        return;
      }
      playAt(queue, index - 1);
    },

    jump: (key) => {
      const { queue, index } = get();
      const at = queue.findIndex((e) => e.key === key);
      if (at < 0) return;
      if (at === index) {
        get().toggle();
        return;
      }
      leaving("skip");
      playAt(queue, at);
    },

    remove: (key) => {
      const s = get();
      const at = s.queue.findIndex((e) => e.key === key);
      const gone = s.queue[at];
      if (!gone || at <= s.index) return;
      const beforeKey = s.queue[at + 1]?.key ?? null;
      const originalThen = s.original;
      set(without(s, new Set([key])));
      get().say(`Убрал «${gone.track.title}»`, {
        label: "Вернуть",
        run: () => set((now) => putBack(now, [gone], beforeKey, originalThen)),
      });
    },

    clearAhead: () => {
      const s = get();
      const lost = s.queue.slice(s.index + 1);
      if (s.index < 0 || lost.length === 0) return;
      const originalThen = s.original;
      set(without(s, new Set(lost.map((e) => e.key))));
      get().say(
        s.options.refill
          ? `Убрал ${tracksWord(lost.length)} — подборка подберёт новые`
          : `Очередь очищена: убрал ${tracksWord(lost.length)}`,
        { label: "Вернуть", run: () => set((now) => putBack(now, lost, null, originalThen)) },
      );
    },

    move: (key, beforeKey) => set((s) => moveBefore(s, key, beforeKey)),

    moveBy: (key, step) => {
      const before = get().queue;
      set((s) => moveBy(s, key, step));
      return get().queue !== before;
    },

    toggleShuffle: () => {
      const s = get();
      const now = s.queue[s.index];
      if (!now) return;
      if (s.options.refill) {
        get().say("Подборка и так вперемешку");
        return;
      }
      if (s.original) {
        set(shuffleOff(s));
        get().say(`Вернул порядок ${orderOf(s.source)}`);
        return;
      }
      const left = s.queue.filter((e) => e.key !== now.key && !e.added && !s.heard.has(e.key));
      if (left.length === 0) {
        get().say(
          s.queue.length <= 1
            ? "Перемешивать нечего: в очереди один трек"
            : "Перемешивать нечего: всё в очереди уже играло",
        );
        return;
      }
      set(shuffleOn(s, s.heard));
      get().say(`Перемешал всё, что ещё не играло: ${tracksWord(left.length)}`);
    },

    cycleRepeat: () => {
      const { repeat, options } = get();
      // An endless queue never ends, so it has nothing to start again.
      const cycle: readonly Repeat[] = options.refill ? ["off", "one"] : REPEATS;
      const next = cycle[(cycle.indexOf(repeat) + 1) % cycle.length] ?? "off";
      set({ repeat: next });
      try {
        localStorage.setItem(REPEAT_KEY, next);
      } catch {
        // Private storage unavailable: the mode just won't survive a restart.
      }
      get().say(
        next === "all"
          ? "Повтор очереди: после последнего трека — снова первый"
          : next === "one"
            ? "Повтор трека: этот трек по кругу"
            : "Повтор выключен",
      );
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

    replaceUpcoming: (tracks) => set((s) => replaceAhead(s, tracks)),

    extendSource: (tracks) => set((s) => extend(s, tracks)),

    playNext: (track, source) => {
      const { index, queue } = get();
      if (index < 0 || !queue[index]) {
        get().playQueue([track], 0, source);
        return;
      }
      set((s) => insertNext(s, track));
      get().say(`Дальше: ${track.title}`);
    },

    say: (notice, action) => set({ notice, noticeAction: action ?? null }),

    report: (patch) => set(patch),

    stop: () =>
      set((s) => ({
        queue: [],
        index: -1,
        original: null,
        heard: new Set(),
        source: null,
        options: {},
        playing: false,
        buffering: false,
        position: 0,
        duration: 0,
        startAt: 0,
        notice: null,
        noticeAction: null,
        loadId: s.loadId + 1,
      })),
  };
});

export function currentTrack(state: { queue: readonly QueueEntry[]; index: number }): Track | null {
  return state.queue[state.index]?.track ?? null;
}

/** Whether there is a track to go on to: the queue's next one, more of an endless source, or the top again. */
export function hasNext(
  state: Pick<PlayerState, "queue" | "index" | "options" | "repeat">,
): boolean {
  return (
    state.index + 1 < state.queue.length ||
    Boolean(state.options.refill) ||
    (state.repeat === "all" && state.queue.length > 0)
  );
}
