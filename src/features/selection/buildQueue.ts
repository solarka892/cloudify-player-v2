import type { Track } from "@/api/types";
import { isCalm, isUpbeat, type MoodId } from "@/features/selection/moods";

// «Подборка», first version: your likes shuffled, interleaved with SoundCloud's
// radio from what you played last. Everything here is a rule you can read;
// it learns from the listening diary once the app keeps one.

export interface SelectionInput {
  likes: readonly Track[];
  /** Latest first. */
  history: readonly Track[];
  /** SoundCloud's station from a recent track. */
  station: readonly Track[];
  /** «Не то» and early skips: never offered again. */
  skipped: ReadonlySet<number>;
  /** Already in the queue: not offered twice. */
  exclude?: ReadonlySet<number>;
  mood: MoodId;
  seed: number;
}

/** A mood needs at least this many matching tracks, or it honestly says it found none. */
export const MIN_MOOD_TRACKS = 5;
const MAX_QUEUE = 200;
/** Tracks played this recently wait until the rest of the likes had a turn. */
const RECENT = 30;

/** Whether this account can hear the track here at all. */
export function canPlay(track: Track): boolean {
  return track.access.playable && track.access.policy !== "block";
}

/** Deterministic, so the same seed gives the same order (and tests can check it). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function unique(tracks: Iterable<Track>, keep: (track: Track) => boolean): Track[] {
  const seen = new Set<number>();
  const out: Track[] = [];
  for (const track of tracks) {
    if (seen.has(track.id) || !keep(track)) continue;
    seen.add(track.id);
    out.push(track);
  }
  return out;
}

/** Two likes, then one new track from the radio, while both last. */
function interleave(liked: Track[], fresh: Track[]): Track[] {
  const out: Track[] = [];
  let l = 0;
  let f = 0;
  while (l < liked.length || f < fresh.length) {
    for (let i = 0; i < 2 && l < liked.length; i++) out.push(liked[l++] as Track);
    if (f < fresh.length) out.push(fresh[f++] as Track);
  }
  return out;
}

export function buildQueue(input: SelectionInput): Track[] {
  const { likes, history, station, skipped, mood } = input;
  const next = random(input.seed);
  const exclude = input.exclude ?? new Set<number>();
  // A Go+ preview is half a minute of a song: fine when picked by hand, not in an endless mix.
  const usable = (track: Track) =>
    canPlay(track) && !track.access.preview && !skipped.has(track.id) && !exclude.has(track.id);

  const likedIds = new Set(likes.map((track) => track.id));
  const recent = new Set(history.slice(0, RECENT).map((track) => track.id));
  const liked = unique(likes, usable);
  // Recently played likes go to the back, so the start feels fresh.
  const likedOrder = [
    ...shuffled(
      liked.filter((track) => !recent.has(track.id)),
      next,
    ),
    ...shuffled(
      liked.filter((track) => recent.has(track.id)),
      next,
    ),
  ];
  const fresh = shuffled(
    unique(station, (track) => usable(track) && !likedIds.has(track.id) && !recent.has(track.id)),
    next,
  );

  let queue: Track[];
  switch (mood) {
    case "usual":
      queue = interleave(likedOrder, fresh);
      break;
    case "fav":
      queue = likedOrder;
      break;
    case "new": {
      const likedArtists = new Set(likes.map((track) => track.user?.id).filter(Boolean));
      const strangers = fresh.filter((track) => !likedArtists.has(track.user?.id));
      queue = strangers.length >= MIN_MOOD_TRACKS ? strangers : fresh;
      break;
    }
    case "up":
    case "calm": {
      const fits = mood === "up" ? isUpbeat : isCalm;
      queue = interleave(likedOrder.filter(fits), fresh.filter(fits));
      if (queue.length < MIN_MOOD_TRACKS) queue = [];
      break;
    }
  }
  return queue.slice(0, MAX_QUEUE);
}
