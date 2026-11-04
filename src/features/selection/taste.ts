// What the listening diary says about each track and each artist: how often it
// was heard to the end, left early, started over, liked, sent away with «не то».
// Plain counts and one rule for turning them into a lean towards or away; the
// selection reads it, nothing here decides what plays.

/** How a play ended, as the diary hands it over (`PlayRow[3]`). */
export const OUTCOME = { finished: 0, skipped: 1, rejected: 2, again: 3, stopped: 4 } as const;

/** Flags of a play (`PlayRow[7]`): liked while it played, «больше такого» pressed, added by hand. */
export const FLAG = { liked: 1, more: 2, added: 4 } as const;

/**
 * One closed play: the track, its artist, when it started (ms since 1970), how
 * it ended, seconds really heard, where it ended and how long the track was.
 * Numbers only, newest first, so a year of listening stays small.
 */
export type PlayRow = readonly [
  track: number,
  artist: number | null,
  at: number,
  outcome: number,
  heardS: number,
  positionS: number,
  durationS: number,
  flags: number,
];

/** Leaving a track this early says "not for me"; the selection already treats 30 s that way. */
export const EARLY_S = 30;
/** Leaving in the last quarter is as good as hearing it out. */
const LATE_SHARE = 0.75;
/** A play counts half after this many days, a quarter after twice as many. */
const HALF_LIFE_DAYS = 120;
const DAY_MS = 86_400_000;

/** Everything the diary knows about one track, or about all of one artist's tracks. */
export interface Evidence {
  /** Closed plays. */
  plays: number;
  finished: number;
  /** Started over (on repeat, or sent back to its start). */
  again: number;
  /** Left with «не то». */
  rejected: number;
  /** Left within its first half-minute heard. */
  early: number;
  /** Left somewhere in the middle. */
  mid: number;
  /** Left in its last quarter. */
  late: number;
  /** Plays it was liked during. */
  liked: number;
  /** Plays «больше такого» was pressed during. */
  more: number;
  /** For and against, with older plays counting less. */
  good: number;
  bad: number;
  /** When it last started, and when it was last heard to the end. */
  lastAt: number;
  lastFinishedAt: number | null;
}

export interface Taste {
  /** Plays that say something about taste: heard out, left, started over, «не то». */
  plays: number;
  tracks: ReadonlyMap<number, Evidence>;
  artists: ReadonlyMap<number, Evidence>;
}

export const NO_TASTE: Taste = { plays: 0, tracks: new Map(), artists: new Map() };

function empty(): Evidence {
  return {
    plays: 0,
    finished: 0,
    again: 0,
    rejected: 0,
    early: 0,
    mid: 0,
    late: 0,
    liked: 0,
    more: 0,
    good: 0,
    bad: 0,
    lastAt: 0,
    lastFinishedAt: null,
  };
}

function add(into: Map<number, Evidence>, id: number, row: PlayRow, weight: number) {
  let e = into.get(id);
  if (!e) {
    e = empty();
    into.set(id, e);
  }
  const [, , at, outcome, heardS, positionS, durationS, flags] = row;
  e.plays += 1;
  e.lastAt = Math.max(e.lastAt, at);
  let good = 0;
  let bad = 0;
  switch (outcome) {
    case OUTCOME.finished:
      e.finished += 1;
      e.lastFinishedAt = Math.max(e.lastFinishedAt ?? 0, at);
      good += 1;
      break;
    case OUTCOME.again:
      e.again += 1;
      e.lastFinishedAt = Math.max(e.lastFinishedAt ?? 0, at);
      good += 1.5;
      break;
    case OUTCOME.rejected:
      e.rejected += 1;
      bad += 3;
      break;
    case OUTCOME.skipped:
      if (heardS < EARLY_S) {
        e.early += 1;
        bad += 1;
      } else if (durationS > 0 && positionS >= durationS * LATE_SHARE) {
        e.late += 1;
        good += 0.8;
      } else {
        e.mid += 1;
        bad += 0.4;
      }
      break;
    default:
      // Stopped: the app closed or the track broke off; says nothing about taste.
      break;
  }
  if (flags & FLAG.liked) {
    e.liked += 1;
    good += 1.5;
  }
  if (flags & FLAG.more) {
    e.more += 1;
    good += 2;
  }
  e.good += good * weight;
  e.bad += bad * weight;
}

/** Counts the diary's plays per track and per artist. */
export function learn(rows: readonly PlayRow[], now: number): Taste {
  const tracks = new Map<number, Evidence>();
  const artists = new Map<number, Evidence>();
  let plays = 0;
  for (const row of rows) {
    const [track, artist, at, outcome] = row;
    if (outcome !== OUTCOME.stopped) plays += 1;
    const weight = 0.5 ** (Math.max(0, now - at) / DAY_MS / HALF_LIFE_DAYS);
    add(tracks, track, row, weight);
    if (artist !== null) add(artists, artist, row, weight);
  }
  return { plays, tracks, artists };
}

/**
 * The lean towards (up to 1) or away (down to −1). Few plays lean little:
 * `prior` is how many plays' worth of doubt there is before the counts speak.
 */
export function affinity(e: Evidence, prior: number): number {
  return (e.good - e.bad) / (e.good + e.bad + prior);
}

/**
 * The diary has said "never": a «не то», or two early skips without ever being
 * heard to the end.
 */
export function refused(e: Evidence | undefined): boolean {
  if (!e) return false;
  return e.rejected > 0 || (e.early >= 2 && e.finished + e.again + e.late === 0);
}

/** Heard enough of it to know it: it is not new any more. */
export function known(e: Evidence | undefined): boolean {
  if (!e) return false;
  return e.finished + e.again + e.late + e.mid > 0;
}
