import type { Track } from "@/api/types";
import { shuffled } from "@/features/library/shuffle";
import { isCalm, isUpbeat, type MoodId } from "@/features/selection/moods";
import { placeOf, random } from "@/features/selection/random";
import { affinity, type Evidence, known, refused, type Taste } from "@/features/selection/taste";

// «Подборка»: tracks from several sources, a score for each from what you did
// with it (the listening diary), and a queue that mixes the familiar and the
// new the way the slider says. Rules you can read, and no model ranks anything.
//
// With nothing in the diary and nothing steered, it is exactly the first
// version: your likes shuffled, two of them, then one track from SoundCloud's
// radio. What the diary teaches comes in gradually: after 30 plays it has half
// the say, after 300 almost all of it. The setting a track played in (night,
// winter, a short day) can join later as more terms of the same score.

/** Where a candidate comes from. */
export type SourceId = "likes" | "history" | "winter" | "yearAgo" | "stations" | "related";
export type Side = "familiar" | "new";

export const SOURCES: readonly SourceId[] = [
  "likes",
  "history",
  "winter",
  "yearAgo",
  "stations",
  "related",
];

export const SIDE: Readonly<Record<SourceId, Side>> = {
  likes: "familiar",
  history: "familiar",
  winter: "familiar",
  yearAgo: "familiar",
  stations: "new",
  related: "new",
};

/**
 * How often each source fills its side's places when all are «как обычно»:
 * likes lead the familiar side, the radio and related tracks share the new one.
 */
const BASE_WEIGHT: Readonly<Record<SourceId, number>> = {
  likes: 4,
  history: 2,
  winter: 1,
  yearAgo: 1,
  stations: 1,
  related: 1,
};

export interface SourceSetting {
  on: boolean;
  /** 1 as usual; 0.5 less often, 2 more often. */
  weight: number;
}

export interface SelectionSettings {
  /** How much of the queue is new, in twelfths: 0 only the familiar, 12 only the new. */
  novelty: number;
  sources: Readonly<Record<SourceId, SourceSetting>>;
}

export const NOVELTY_STEPS = 12;
/** One new track in three: the first version's two likes and one from the radio. */
export const DEFAULT_NOVELTY = 4;

export const DEFAULT_SETTINGS: SelectionSettings = {
  novelty: DEFAULT_NOVELTY,
  sources: {
    likes: { on: true, weight: 1 },
    history: { on: true, weight: 1 },
    winter: { on: true, weight: 1 },
    yearAgo: { on: true, weight: 1 },
    stations: { on: true, weight: 1 },
    related: { on: true, weight: 1 },
  },
};

/** What a radio or a related list grew from, and why that track. */
export interface Seed {
  track: Track;
  /** Heard to the end lately; played last; the latest like; «больше такого». */
  reason: "finished" | "played" | "liked" | "more";
  /** When that happened, if known. */
  at: number | null;
}

/** One source's candidates. A radio and a related list carry the track they grew from. */
export interface Pool {
  source: SourceId;
  seed?: Seed | null | undefined;
  tracks: readonly Track[];
  /** How many times each was heard in the window it comes from (last winter, a year ago). */
  heard?: ReadonlyMap<number, number> | undefined;
}

/** A press in the player while the selection plays, or an early skip. Lasts the session. */
export interface Steer {
  kind: "more" | "less" | "skip";
  track: Track;
  /** The track the steered one's radio or related list grew from, if it came from one. */
  from: number | null;
  at: number;
}

/** One fact behind a pick, worked out here; the «почему» line only words it. */
export type Fact =
  /** Close to a track «больше такого» was pressed on. */
  | { kind: "more"; track: Track }
  | { kind: "liked" }
  | { kind: "station"; seed: Seed }
  | { kind: "related"; seed: Seed }
  | { kind: "history"; at: number | null }
  | { kind: "winter"; times: number }
  | { kind: "yearAgo"; times: number }
  /** Heard to the end (or started over) `times` of `of` plays. */
  | { kind: "finished"; times: number; of: number }
  | { kind: "again"; times: number }
  /** Heard to the end more than once, and not since then. */
  | { kind: "missed"; at: number }
  /** An artist you hear to the end. */
  | { kind: "artist"; name: string; finished: number; plays: number }
  /** An artist that is not in your likes or your diary. */
  | { kind: "stranger" }
  /** Nothing learned yet: the rules the selection starts with. */
  | { kind: "rules" };

export interface Pick {
  track: Track;
  source: SourceId;
  seed: Seed | null;
  facts: readonly Fact[];
}

export interface SelectionInput {
  likes: readonly Track[];
  /** SoundCloud's own play history, latest first: its first thirty count as just played. */
  history: readonly Track[];
  pools: readonly Pool[];
  /** What the diary taught; `null` (or nothing in it) is the cold start. */
  taste: Taste | null;
  steers?: readonly Steer[] | undefined;
  /** «Не то» and early skips: never offered again. */
  skipped: ReadonlySet<number>;
  /** Already in the queue: not offered twice. */
  exclude?: ReadonlySet<number> | undefined;
  mood: MoodId;
  settings?: SelectionSettings | undefined;
  seed: number;
  now?: number | undefined;
  /** Places from an earlier build, so a rebuild moves only what changed. */
  places?: ReadonlyMap<number, number> | undefined;
  /** What plays just before this queue, latest last: its artists are kept apart from the start. */
  before?: readonly Track[] | undefined;
}

export interface SourceCount {
  /** Candidates the source offered after the rules (what can play, what is not refused). */
  offered: number;
  /** How many of them are in this queue. */
  picked: number;
}

export interface Selection {
  picks: Pick[];
  /** Each candidate's place, to hand back for a rebuild. */
  places: ReadonlyMap<number, number>;
  /** How much of the score is learned, 0 (nothing yet) to almost 1. */
  learned: number;
  sources: Readonly<Record<SourceId, SourceCount>>;
}

/** A mood needs at least this many matching tracks, or it honestly says it found none. */
export const MIN_MOOD_TRACKS = 5;
export const MAX_QUEUE = 200;
/** SoundCloud history's first tracks count as just played. */
const RECENT = 30;
/** The diary's plays this recent count as just played. */
const RECENT_MS = 24 * 3_600_000;
const DAY_MS = 86_400_000;
/** Plays after which what was learned has half the say (spec 26's k). */
export const LEARNING_PLAYS = 30;
/** Doubt before the counts speak: a few plays lean little. */
const TRACK_PRIOR = 2;
const ARTIST_PRIOR = 4;
/** An artist's lean counts for a bit more than half of a track's own. */
const ARTIST_SHARE = 0.6;
/** A favourite not heard for a month comes forward a little. */
const MISSED_DAYS = 30;
const MISSED_BONUS = 0.3;
/** Learned queues keep an artist out of the next two places. */
const SPREAD = 2;
/** How far down a source's list to look for another artist: far enough for a library of favourites. */
const LOOK = 600;
/** A recent track goes behind everything else. */
const BACK = 10;

const NONE: ReadonlySet<number> = new Set();

/** Whether this account can hear the track here at all. */
export function canPlay(track: Track): boolean {
  return track.access.playable && track.access.policy !== "block";
}

const artistOf = (track: Track): number | null => track.user?.id ?? null;

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

interface Candidate {
  track: Track;
  source: SourceId;
  seed: Seed | null;
  place: number;
  /** Lower plays sooner: the place, moved by what was learned and steered. */
  value: number;
}

/**
 * Builds the queue. Deterministic: the same input and seed give the same
 * queue, and with an empty diary it is the first version's queue.
 */
export function select(input: SelectionInput): Selection {
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const now = input.now ?? Date.now();
  const steers = input.steers ?? [];
  const taste = input.taste && input.taste.plays > 0 ? input.taste : null;
  const learned = taste ? taste.plays / (taste.plays + LEARNING_PLAYS) : 0;
  const cold = learned === 0 && steers.length === 0;
  const exclude = input.exclude ?? NONE;
  const on = (source: SourceId) => settings.sources[source].on;
  const evidence = (id: number) => taste?.tracks.get(id);
  const artistEvidence = (track: Track) => {
    const artist = artistOf(track);
    return artist === null ? undefined : taste?.artists.get(artist);
  };

  const sentAway = new Set(steers.filter((s) => s.kind === "less").map((s) => s.track.id));
  // A Go+ preview is half a minute of a song: fine when picked by hand, not in an endless mix.
  const usable = (track: Track) =>
    canPlay(track) &&
    !track.access.preview &&
    !input.skipped.has(track.id) &&
    !sentAway.has(track.id) &&
    !refused(evidence(track.id)) &&
    !exclude.has(track.id);

  const likedIds = new Set(input.likes.map((track) => track.id));
  const recent = new Set(input.history.slice(0, RECENT).map((track) => track.id));
  if (taste) {
    for (const [id, e] of taste.tracks) if (now - e.lastAt < RECENT_MS) recent.add(id);
  }

  const places = new Map<number, number>();
  const given = input.places;
  const next = random(input.seed);
  const placeFor = (id: number) => given?.get(id) ?? placeOf(input.seed, id);

  // The familiar side: your likes, recently played ones last…
  const likes = on("likes") ? unique(input.likes, usable) : [];
  if (given) {
    for (const track of likes) places.set(track.id, placeFor(track.id));
  } else {
    const order = [
      ...shuffled(
        likes.filter((track) => !recent.has(track.id)),
        next,
      ),
      ...shuffled(
        likes.filter((track) => recent.has(track.id)),
        next,
      ),
    ];
    order.forEach((track, i) => {
      places.set(track.id, i / order.length);
    });
  }

  // …then what the diary says you hear to the end: history, last winter, a year ago.
  const familiar = new Map<number, { source: SourceId; pool: Pool | null; track: Track }>();
  for (const track of likes) familiar.set(track.id, { source: "likes", pool: null, track });
  const welcome = (pool: Pool, track: Track) => {
    if (pool.source !== "history") return true;
    // History is only what you have been hearing out: the diary has to say so.
    const own = evidence(track.id);
    if (own) return affinity(own, TRACK_PRIOR) > 0.15;
    const artist = artistEvidence(track);
    return artist !== undefined && affinity(artist, ARTIST_PRIOR) > 0.25;
  };
  for (const pool of input.pools) {
    if (SIDE[pool.source] !== "familiar" || pool.source === "likes" || !on(pool.source)) continue;
    for (const track of pool.tracks) {
      if (familiar.has(track.id) || recent.has(track.id) || !usable(track)) continue;
      if (on("likes") && likedIds.has(track.id)) continue;
      if (!welcome(pool, track)) continue;
      familiar.set(track.id, { source: pool.source, pool, track });
      places.set(track.id, placeFor(track.id));
    }
  }

  // The new side: the radio and related tracks, without what you like, just
  // heard, or already know from the diary.
  const newPools = input.pools.filter((pool) => SIDE[pool.source] === "new" && on(pool.source));
  const origin = new Map<number, Pool>();
  for (const pool of newPools) {
    for (const track of pool.tracks) if (!origin.has(track.id)) origin.set(track.id, pool);
  }
  const fresh = unique(
    newPools.flatMap((pool) => pool.tracks),
    (track) =>
      usable(track) &&
      !likedIds.has(track.id) &&
      !recent.has(track.id) &&
      !familiar.has(track.id) &&
      !known(evidence(track.id)),
  );
  if (given) {
    for (const track of fresh) places.set(track.id, placeFor(track.id));
  } else {
    shuffled(fresh, next).forEach((track, i) => {
      places.set(track.id, i / fresh.length);
    });
  }

  // What the diary taught, and what was pressed this session.
  const lean = (track: Track): number => {
    if (!taste) return 0;
    let score = 0;
    const own = evidence(track.id);
    if (own) {
      score += affinity(own, TRACK_PRIOR);
      const days = (now - own.lastAt) / DAY_MS;
      if (own.finished + own.again >= 2 && days > MISSED_DAYS) score += MISSED_BONUS;
      // Heard in the last week: let it rest a while longer.
      if (days < 7) score -= 0.6 * 0.5 ** (days / 2);
    }
    const artist = artistEvidence(track);
    if (artist) score += ARTIST_SHARE * affinity(artist, ARTIST_PRIOR);
    return learned * score;
  };
  const steered = (track: Track, seed: Seed | null): number => {
    let score = 0;
    const artist = artistOf(track);
    for (const steer of steers) {
      const same = artist !== null && artist === artistOf(steer.track);
      // Grown from the steered track itself, or a sibling from the list it came from.
      const child = seed !== null && seed.track.id === steer.track.id;
      const sibling = seed !== null && steer.from !== null && seed.track.id === steer.from;
      if (steer.kind === "more") score += (same ? 0.8 : 0) + (child ? 0.6 : sibling ? 0.2 : 0);
      else if (steer.kind === "less") score -= (same ? 1.5 : 0) + (sibling ? 0.3 : 0);
      else score -= (same ? 0.5 : 0) + (sibling ? 0.15 : 0);
    }
    return score;
  };
  const candidate = (track: Track, source: SourceId, seed: Seed | null): Candidate => {
    const place = places.get(track.id) ?? placeFor(track.id);
    const value = place + (recent.has(track.id) ? BACK : 0) - lean(track) - steered(track, seed);
    return { track, source, seed, place, value };
  };

  const fits = input.mood === "up" ? isUpbeat : input.mood === "calm" ? isCalm : () => true;
  const lists = new Map<SourceId, Candidate[]>();
  const push = (c: Candidate) => {
    if (!fits(c.track)) return;
    const list = lists.get(c.source);
    if (list) list.push(c);
    else lists.set(c.source, [c]);
  };
  for (const { source, track } of familiar.values()) push(candidate(track, source, null));
  let newOnes = fresh;
  if (input.mood === "new") {
    // «Незнакомое»: artists who are not in your likes, when there are enough of them.
    const likedArtists = new Set(input.likes.map((track) => track.user?.id).filter(Boolean));
    const strangers = fresh.filter((track) => !likedArtists.has(track.user?.id));
    if (strangers.length >= MIN_MOOD_TRACKS) newOnes = strangers;
  }
  for (const track of newOnes) {
    const pool = origin.get(track.id);
    if (pool) push(candidate(track, pool.source, pool.seed ?? null));
  }
  for (const list of lists.values()) {
    list.sort((a, b) => a.value - b.value || a.place - b.place || a.track.id - b.track.id);
  }

  const counts = Object.fromEntries(
    SOURCES.map((source) => [source, { offered: lists.get(source)?.length ?? 0, picked: 0 }]),
  ) as Record<SourceId, SourceCount>;

  // Fill the queue: familiar and new places as the slider says; within a side,
  // each source as often as its weight; within a source, the best first.
  const novelty =
    input.mood === "fav"
      ? 0
      : input.mood === "new"
        ? NOVELTY_STEPS
        : Math.max(0, Math.min(NOVELTY_STEPS, Math.round(settings.novelty)));
  const only = novelty === 0 ? "familiar" : novelty === NOVELTY_STEPS ? "new" : null;
  const gap = cold ? 0 : SPREAD;
  const used = new Set<number>();
  const cursor = new Map<SourceId, number>();
  const credit = new Map<SourceId, number>();
  const lastArtists: (number | null)[] = (input.before ?? []).slice(-SPREAD).map(artistOf);

  const firstFree = (source: SourceId): number => {
    const list = lists.get(source) ?? [];
    let at = cursor.get(source) ?? 0;
    while (at < list.length && used.has((list[at] as Candidate).track.id)) at += 1;
    cursor.set(source, at);
    return at;
  };
  const live = (side: Side) =>
    SOURCES.filter(
      (source) => SIDE[source] === side && firstFree(source) < (lists.get(source)?.length ?? 0),
    );
  const takeFrom = (side: Side): Candidate | null => {
    const sources = live(side);
    if (sources.length === 0) return null;
    // Smooth weighted round-robin: each source as often as its weight, evenly spread.
    let total = 0;
    let best: SourceId | null = null;
    for (const source of sources) {
      const weight = BASE_WEIGHT[source] * Math.max(0, settings.sources[source].weight);
      const credited = (credit.get(source) ?? 0) + weight;
      credit.set(source, credited);
      total += weight;
      if (best === null || credited > (credit.get(best) ?? 0)) best = source;
    }
    const chosen = best as SourceId;
    credit.set(chosen, (credit.get(chosen) ?? 0) - total);
    const first = (lists.get(chosen) ?? [])[firstFree(chosen)] ?? null;
    if (gap === 0) return first;
    // Keep the last artists apart: the chosen source's next ones first, then the side's others.
    const avoid = new Set(lastArtists.slice(-gap).filter((a) => a !== null));
    const others = sources
      .filter((source) => source !== chosen)
      .sort((a, b) => (credit.get(b) ?? 0) - (credit.get(a) ?? 0));
    for (const source of [chosen, ...others]) {
      const list = lists.get(source) ?? [];
      const start = firstFree(source);
      for (let at = start; at < Math.min(list.length, start + LOOK); at++) {
        const c = list[at] as Candidate;
        if (used.has(c.track.id)) continue;
        const artist = artistOf(c.track);
        if (artist === null || !avoid.has(artist)) return c;
      }
    }
    return first;
  };

  const chosen: Candidate[] = [];
  let familiarCount = 0;
  while (chosen.length < MAX_QUEUE) {
    const wantFamiliar =
      only === "familiar" ||
      (only === null &&
        familiarCount * NOVELTY_STEPS < (NOVELTY_STEPS - novelty) * (chosen.length + 1));
    const want: Side = wantFamiliar ? "familiar" : "new";
    let c = takeFrom(want);
    if (!c && only === null) c = takeFrom(want === "familiar" ? "new" : "familiar");
    if (!c) break;
    used.add(c.track.id);
    chosen.push(c);
    if (SIDE[c.source] === "familiar") familiarCount += 1;
    lastArtists.push(artistOf(c.track));
    counts[c.source].picked += 1;
  }
  if ((input.mood === "up" || input.mood === "calm") && chosen.length < MIN_MOOD_TRACKS) {
    return { picks: [], places, learned, sources: counts };
  }

  const likedArtists = new Set(input.likes.map(artistOf).filter((a) => a !== null));
  // Last winter's and a year ago's counts, for tracks picked from another source too.
  const heardThen = new Map<number, Fact>();
  for (const pool of input.pools) {
    if ((pool.source !== "winter" && pool.source !== "yearAgo") || !pool.heard) continue;
    for (const [id, times] of pool.heard) {
      if (!heardThen.has(id)) heardThen.set(id, { kind: pool.source, times });
    }
  }
  const factsOf = (c: Candidate): Fact[] => {
    const facts: Fact[] = [];
    const { track } = c;
    const artist = artistOf(track);
    const asked = steers.find(
      (steer) =>
        steer.kind === "more" &&
        ((artist !== null && artist === artistOf(steer.track)) ||
          (c.seed !== null && c.seed.track.id === steer.track.id)),
    );
    if (asked) facts.push({ kind: "more", track: asked.track });
    const own = evidence(track.id);
    switch (c.source) {
      case "likes":
        facts.push({ kind: "liked" });
        break;
      case "stations":
        if (c.seed) facts.push({ kind: "station", seed: c.seed });
        break;
      case "related":
        if (c.seed) facts.push({ kind: "related", seed: c.seed });
        break;
      case "history":
        facts.push({ kind: "history", at: own?.lastFinishedAt ?? own?.lastAt ?? null });
        break;
      case "winter":
      case "yearAgo":
        facts.push(heardThen.get(track.id) ?? { kind: c.source, times: 1 });
        break;
    }
    if (own) {
      const heardOut = own.finished + own.again;
      if (heardOut > 0) facts.push({ kind: "finished", times: heardOut, of: own.plays });
      if (own.again >= 2) facts.push({ kind: "again", times: own.again });
      if (heardOut >= 2 && now - own.lastAt > MISSED_DAYS * DAY_MS)
        facts.push({ kind: "missed", at: own.lastAt });
    }
    const theirs = artistEvidence(track);
    if (theirs && theirs.finished + theirs.again >= 3 && affinity(theirs, ARTIST_PRIOR) > 0.3) {
      facts.push({
        kind: "artist",
        name: track.user?.username ?? "",
        finished: theirs.finished + theirs.again,
        plays: theirs.plays,
      });
    }
    const then = heardThen.get(track.id);
    if (then && c.source !== "winter" && c.source !== "yearAgo") facts.push(then);
    if (SIDE[c.source] === "new" && artist !== null && !likedArtists.has(artist) && !theirs) {
      facts.push({ kind: "stranger" });
    }
    if (!taste) facts.push({ kind: "rules" });
    return facts;
  };

  return {
    picks: chosen.map((c) => ({
      track: c.track,
      source: c.source,
      seed: c.seed,
      facts: factsOf(c),
    })),
    places,
    learned,
    sources: counts,
  };
}

/** Just the tracks, for the places that only need what plays. */
export function tracksOf(selection: Selection): Track[] {
  return selection.picks.map((pick) => pick.track);
}

/** The evidence about a track, for the «почему» line of a track picked elsewhere. */
export type { Evidence };
