import {
  diaryEnd,
  diaryLiked,
  diaryMore,
  diaryProgress,
  diaryStart,
  diaryUnreject,
} from "@/api/diary";
import type { Heard, PlayOutcome, PlaySource, Track } from "@/api/types";
import {
  currentTrack,
  type LeaveReason,
  onLeave,
  type QueueSource,
  usePlayer,
} from "@/features/player/store";
import { actionFailed } from "@/features/problems/watch";
import { actionWords } from "@/features/problems/words";

// The listening diary's pen. It watches the player and tells the diary (a file
// Rust keeps on this computer) about every play: when its sound started and
// from where, how much of it was really heard, and how it ended. A play begins
// with its first heard sound, so a track that never played is not written.
// Everything is told in order, one call after another.

/** How often a playing track's progress is written down. */
export const SAVE_EVERY_MS = 15_000;
/** A step of the position bigger than this is a seek, not sound being heard. */
const MAX_STEP_S = 1.5;

type State = ReturnType<typeof usePlayer.getState>;

/** One play of one load of a track, from its first sound until it is left. */
interface Pen {
  loadId: number;
  track: Track;
  source: PlaySource;
  added: boolean;
  /** Seconds really heard. */
  listened: number;
  /** The last position seen, in seconds. */
  position: number;
  /** Its sound has started, so it is written (or being written). */
  started: boolean;
  /** The diary's id, once it has answered; `null` if it never will. */
  id: number | null;
  /** A like made before the diary answered, to tell it after. */
  liked: boolean | null;
  /** «Больше такого» pressed before the diary answered, to tell it after. */
  more: boolean | null;
  /** How it ended, once it has. */
  outcome: PlayOutcome | null;
  savedAt: number;
  closed: boolean;
}

let pen: Pen | null = null;
/** The last few plays closed, newest first: «Вернуть» can still reach them. */
let lately: Pen[] = [];
const LATELY = 8;
let chain: Promise<void> = Promise.resolve();
const written = new Set<() => void>();

/** Hears every time the diary has written something down (the screen reads it again). */
export function onDiaryWritten(listener: () => void): () => void {
  written.add(listener);
  return () => {
    written.delete(listener);
  };
}

/** Runs `job` after everything told before it. */
function later(job: () => Promise<unknown>, tell = true) {
  chain = chain.then(job).then(
    () => {
      if (tell) for (const listener of written) listener();
    },
    (error: unknown) => {
      actionFailed(
        "diary",
        actionWords(
          "Дневник не записывается",
          "Прослушивания сейчас не сохраняются, а музыка играет как обычно.",
          error,
        ),
        error,
      );
    },
  );
}

/** Resolves once everything told so far has been written (or has failed). */
export function diaryWritten(): Promise<void> {
  return chain;
}

/** The player's queue source as the diary keeps it. */
export function sourceOf(source: QueueSource | null): PlaySource {
  if (!source) return { kind: "other", title: null, id: null };
  switch (source.kind) {
    case "playlist":
      return { kind: "playlist", title: source.title, id: source.id ?? null };
    case "artist":
    case "station":
    case "search":
    case "diary":
      return { kind: source.kind, title: source.title, id: null };
    default:
      return { kind: source.kind, title: null, id: null };
  }
}

/** How a play ended, by why the player left it. */
export function outcomeOf(reason: LeaveReason): PlayOutcome {
  switch (reason) {
    case "ended":
      return "finished";
    case "again":
      return "again";
    case "dislike":
      return "rejected";
    case "skip":
    case "replaced":
      return "skipped";
    case "unavailable":
    case "stopped":
      return "stopped";
  }
}

const heardOf = (p: Pen): Heard => ({
  positionMs: Math.round(p.position * 1000),
  listenedMs: Math.round(p.listened * 1000),
});

function penFor(s: State): Pen | null {
  const entry = s.queue[s.index];
  if (!entry) return null;
  return {
    loadId: s.loadId,
    track: entry.track,
    source: sourceOf(s.source),
    added: entry.added,
    listened: 0,
    position: s.position,
    started: false,
    id: null,
    liked: null,
    more: null,
    outcome: null,
    savedAt: 0,
    closed: false,
  };
}

/**
 * The track was liked (or the like taken back) and SoundCloud took it: if it
 * is the one playing, its play is marked.
 */
export function noteLiked(trackId: number, liked: boolean) {
  const p = pen;
  if (!p || p.closed || p.track.id !== trackId) return;
  if (!p.started) {
    // Its sound has not started yet: told together with the start.
    p.liked = liked;
    return;
  }
  // Runs after the start, so the diary's id is known by then.
  later(async () => {
    if (p.id !== null) await diaryLiked(p.id, liked);
  });
}

/** The play of this track still going on, or else its latest one: what a press refers to. */
function playOf(trackId: number): Pen | null {
  if (pen && pen.track.id === trackId) return pen;
  return lately.find((p) => p.track.id === trackId) ?? null;
}

/**
 * «Больше такого» was pressed (or taken back) on this track: its play is marked,
 * so the selection keeps learning from it.
 */
export function noteMore(trackId: number, more: boolean) {
  const p = playOf(trackId);
  if (!p) return;
  if (!p.started) {
    p.more = more;
    return;
  }
  later(async () => {
    if (p.id !== null) await diaryMore(p.id, more);
  });
}

/** «Не то» taken back: the play that ended with it reads as skipped. */
export function takeBackRejected(trackId: number) {
  const p = lately.find((closed) => closed.track.id === trackId && closed.outcome === "rejected");
  if (!p) return;
  p.outcome = "skipped";
  later(async () => {
    if (p.id !== null) await diaryUnreject(p.id);
  });
}

/**
 * Starts writing the diary as the player plays; returns the function that
 * stops. `clock` is for tests.
 */
export function startDiaryRecorder(clock: () => number = Date.now): () => void {
  const begin = (p: Pen, from: number) => {
    p.started = true;
    p.savedAt = clock();
    const fromMs = Math.round(from * 1000);
    later(async () => {
      p.id = await diaryStart({ track: p.track, source: p.source, added: p.added, fromMs });
      if (p.liked !== null) await diaryLiked(p.id, p.liked);
      if (p.more !== null) await diaryMore(p.id, p.more);
    });
  };

  const save = (p: Pen) => {
    if (!p.started || p.closed) return;
    p.savedAt = clock();
    const heard = heardOf(p);
    later(async () => {
      if (p.id !== null) await diaryProgress(p.id, heard);
    }, false);
  };

  const close = (p: Pen, outcome: PlayOutcome) => {
    if (p.closed) return;
    p.closed = true;
    if (!p.started) return;
    p.outcome = outcome;
    lately = [p, ...lately.filter((other) => other !== p)].slice(0, LATELY);
    const heard = heardOf(p);
    later(async () => {
      if (p.id !== null) await diaryEnd(p.id, outcome, heard);
    });
  };

  const left = (track: Track, reason: LeaveReason, position: number) => {
    const p = pen;
    if (!p || p.closed || p.track.id !== track.id) return;
    p.position = position;
    close(p, outcomeOf(reason));
    // Started over on the same load (sent back to its start): the next sound is a new play.
    if (reason === "again")
      pen = {
        ...p,
        listened: 0,
        started: false,
        id: null,
        liked: null,
        more: null,
        outcome: null,
        closed: false,
      };
  };

  const watch = (s: State, prev: State) => {
    const track = currentTrack(s);
    // Compared with the pen, not with `prev`: a change made while the player
    // reports another can reach this listener after the newer one.
    const fresh = pen ? s.loadId !== pen.loadId || track?.id !== pen.track.id : track !== null;
    if (fresh) {
      // A new load: whatever was open is over (a leave has usually closed it already).
      if (pen) close(pen, "stopped");
      pen = penFor(s);
      return;
    }
    const p = pen;
    if (!p) return;
    if (s.position !== p.position) {
      const step = s.position - p.position;
      if (s.playing && step > 0 && step <= MAX_STEP_S) {
        if (!p.started) begin(p, p.position);
        p.listened += step;
      }
      p.position = s.position;
      if (p.started && clock() - p.savedAt >= SAVE_EVERY_MS) save(p);
    }
    // Paused: write down where, in case the app is closed now.
    if (prev.playing && !s.playing) save(p);
  };

  pen = penFor(usePlayer.getState());
  const stopLeaving = onLeave(left);
  const stopWatching = usePlayer.subscribe(watch);
  return () => {
    stopLeaving();
    stopWatching();
    pen = null;
    lately = [];
  };
}
