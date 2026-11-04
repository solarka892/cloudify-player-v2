import { describe, expect, it } from "vitest";
import type { Track } from "@/api/types";
import {
  DEFAULT_SETTINGS,
  MIN_MOOD_TRACKS,
  type Pool,
  type SelectionInput,
  type SelectionSettings,
  type SourceId,
  select,
  tracksOf,
} from "@/features/selection/engine";
import { isCalm, isUpbeat, type MoodId } from "@/features/selection/moods";
import { FLAG, learn, OUTCOME, type PlayRow } from "@/features/selection/taste";

// --- the first version, frozen ----------------------------------------------------------
// «Подборка» as it played before the engine: likes shuffled (recently played ones
// last), two of them, then one track from the radio. Copied here unchanged so the
// engine can be held to it: with an empty diary it must give exactly this queue.

function firstVersionRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function firstVersionShuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function firstVersionUnique(tracks: Iterable<Track>, keep: (track: Track) => boolean): Track[] {
  const seen = new Set<number>();
  const out: Track[] = [];
  for (const track of tracks) {
    if (seen.has(track.id) || !keep(track)) continue;
    seen.add(track.id);
    out.push(track);
  }
  return out;
}

function firstVersionInterleave(liked: Track[], fresh: Track[]): Track[] {
  const out: Track[] = [];
  let l = 0;
  let f = 0;
  while (l < liked.length || f < fresh.length) {
    for (let i = 0; i < 2 && l < liked.length; i++) out.push(liked[l++] as Track);
    if (f < fresh.length) out.push(fresh[f++] as Track);
  }
  return out;
}

interface FirstVersionInput {
  likes: readonly Track[];
  history: readonly Track[];
  station: readonly Track[];
  skipped: ReadonlySet<number>;
  exclude?: ReadonlySet<number> | undefined;
  mood: MoodId;
  seed: number;
}

function firstVersion(input: FirstVersionInput): Track[] {
  const { likes, history, station, skipped, mood } = input;
  const next = firstVersionRandom(input.seed);
  const exclude = input.exclude ?? new Set<number>();
  const usable = (track: Track) =>
    track.access.playable &&
    track.access.policy !== "block" &&
    !track.access.preview &&
    !skipped.has(track.id) &&
    !exclude.has(track.id);
  const likedIds = new Set(likes.map((track) => track.id));
  const recent = new Set(history.slice(0, 30).map((track) => track.id));
  const liked = firstVersionUnique(likes, usable);
  const likedOrder = [
    ...firstVersionShuffled(
      liked.filter((track) => !recent.has(track.id)),
      next,
    ),
    ...firstVersionShuffled(
      liked.filter((track) => recent.has(track.id)),
      next,
    ),
  ];
  const fresh = firstVersionShuffled(
    firstVersionUnique(
      station,
      (track) => usable(track) && !likedIds.has(track.id) && !recent.has(track.id),
    ),
    next,
  );
  let queue: Track[];
  switch (mood) {
    case "usual":
      queue = firstVersionInterleave(likedOrder, fresh);
      break;
    case "fav":
      queue = likedOrder;
      break;
    case "new": {
      const likedArtists = new Set(likes.map((track) => track.user?.id).filter(Boolean));
      const strangers = fresh.filter((track) => !likedArtists.has(track.user?.id));
      queue = strangers.length >= 5 ? strangers : fresh;
      break;
    }
    case "up":
    case "calm": {
      const fits = mood === "up" ? isUpbeat : isCalm;
      queue = firstVersionInterleave(likedOrder.filter(fits), fresh.filter(fits));
      if (queue.length < 5) queue = [];
      break;
    }
  }
  return queue.slice(0, 200);
}

// --- tracks -----------------------------------------------------------------------------

interface Extra {
  artist?: number | undefined;
  genre?: string | undefined;
  blocked?: boolean | undefined;
  preview?: boolean | undefined;
}

function track(id: number, extra: Extra = {}): Track {
  return {
    id,
    urn: `soundcloud:tracks:${id}`,
    title: `t${id}`,
    permalinkUrl: null,
    artworkUrl: null,
    durationMs: 200_000,
    fullDurationMs: 200_000,
    user: extra.artist
      ? {
          id: extra.artist,
          urn: `soundcloud:users:${extra.artist}`,
          username: `a${extra.artist}`,
          fullName: null,
          permalinkUrl: null,
          avatarUrl: null,
          bannerUrl: null,
          description: null,
          city: null,
          countryCode: null,
          followersCount: null,
          followingsCount: null,
          trackCount: null,
          playlistCount: null,
          likesCount: null,
          verified: false,
        }
      : null,
    genre: extra.genre ?? null,
    tags: [],
    description: null,
    createdAt: null,
    playbackCount: null,
    likesCount: null,
    repostsCount: null,
    commentCount: null,
    waveformUrl: null,
    access: {
      policy: extra.blocked ? "block" : "allow",
      monetization: "not-applicable",
      goPlus: Boolean(extra.preview),
      preview: Boolean(extra.preview),
      playable: true,
    },
    downloadable: false,
    license: null,
    labelName: null,
    purchaseUrl: null,
    purchaseTitle: null,
    private: false,
  };
}

const range = (from: number, to: number, extra?: (id: number) => Extra) =>
  Array.from({ length: to - from + 1 }, (_, i) => track(from + i, extra?.(from + i)));

const ids = (tracks: readonly Track[]) => tracks.map((t) => t.id);

const GENRES = ["Phonk", "Ambient", "Drum & Bass", "Lo-Fi", "Hip-hop", "", "Techno", "Piano"];

/** A messy library: artists repeat, genres vary, a few tracks cannot play. */
function library(seed: number) {
  const pick = (id: number) => (id * 2654435761 + seed * 40503) >>> 0;
  const extra = (id: number): Extra => ({
    artist: (pick(id) % 9) + 1,
    genre: GENRES[pick(id) % GENRES.length],
    blocked: pick(id) % 23 === 0,
    preview: pick(id) % 29 === 0,
  });
  const likes = range(1, 60 + (seed % 25), extra);
  const station = [
    ...range(101, 140 + (seed % 15), (id) => ({ ...extra(id), artist: (pick(id) % 12) + 5 })),
    // The radio also brings back some likes and some just-played tracks.
    track(3, extra(3)),
    track(4, extra(4)),
    track(905, extra(905)),
  ];
  const history = [
    track(905, extra(905)),
    ...range(1, 12, extra).filter((_, i) => i % 3 === 0),
    ...range(906, 940, extra),
  ];
  const skipped = new Set([7, 104, 120 + (seed % 9)]);
  return { likes, station, history, skipped };
}

function engineInput(base: FirstVersionInput): SelectionInput {
  return {
    likes: base.likes,
    history: base.history,
    pools: [{ source: "stations", seed: null, tracks: base.station }],
    taste: null,
    skipped: base.skipped,
    exclude: base.exclude,
    mood: base.mood,
    seed: base.seed,
  };
}

const MOODS: MoodId[] = ["usual", "fav", "new", "up", "calm"];

describe("an empty diary plays the first version", () => {
  it("gives exactly its queue, for every mood and many seeds", () => {
    let compared = 0;
    for (let seed = 0; seed < 120; seed++) {
      const lib = library(seed);
      for (const mood of MOODS) {
        const base: FirstVersionInput = {
          ...lib,
          mood,
          seed: seed * 7919 + 17,
          exclude: seed % 4 === 0 ? new Set([2, 110]) : undefined,
        };
        const expected = ids(firstVersion(base));
        expect(ids(tracksOf(select(engineInput(base))))).toEqual(expected);
        if (expected.length > 0) compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(400);
  });

  it("holds for lists that run out on either side, and for no radio at all", () => {
    const shapes: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 7],
      [3, 5],
      [5, 1],
      [2, 2],
      [250, 3],
      [4, 300],
    ];
    for (const [likesCount, stationCount] of shapes) {
      for (let seed = 1; seed < 30; seed++) {
        for (const mood of MOODS) {
          const base: FirstVersionInput = {
            likes: range(1, likesCount, (id) => ({ artist: (id % 4) + 1, genre: GENRES[id % 8] })),
            history: [],
            station: range(1001, 1000 + stationCount, (id) => ({
              artist: (id % 6) + 3,
              genre: GENRES[id % 8],
            })),
            skipped: new Set(),
            mood,
            seed,
          };
          expect(ids(tracksOf(select(engineInput(base))))).toEqual(ids(firstVersion(base)));
        }
      }
    }
  });

  it("an empty diary is the same as no diary", () => {
    const lib = library(3);
    const base: FirstVersionInput = { ...lib, mood: "usual", seed: 42 };
    const withEmpty = select({ ...engineInput(base), taste: learn([], 0) });
    expect(ids(tracksOf(withEmpty))).toEqual(ids(firstVersion(base)));
    expect(withEmpty.learned).toBe(0);
    expect(withEmpty.picks[0]?.facts.some((f) => f.kind === "rules")).toBe(true);
  });

  it("pins the order itself, not only the sameness", () => {
    const queue = tracksOf(
      select({
        likes: range(1, 20, () => ({ artist: 1 })),
        history: [],
        pools: [{ source: "stations", tracks: range(101, 110, () => ({ artist: 2 })) }],
        taste: null,
        skipped: new Set(),
        mood: "usual",
        seed: 7,
      }),
    );
    expect(queue.slice(0, 9).map((t) => (t.id > 100 ? "radio" : "like"))).toEqual([
      "like",
      "like",
      "radio",
      "like",
      "like",
      "radio",
      "like",
      "like",
      "radio",
    ]);
    expect(ids(queue)).toMatchInlineSnapshot(`
      [
        10,
        20,
        105,
        8,
        5,
        109,
        6,
        11,
        104,
        13,
        17,
        107,
        19,
        3,
        106,
        16,
        14,
        101,
        4,
        15,
        102,
        7,
        9,
        108,
        12,
        18,
        103,
        2,
        1,
        110,
      ]
    `);
  });
});

// --- learning from the diary ------------------------------------------------------------

const NOW = Date.UTC(2026, 10, 4, 16, 0, 0);
const DAY = 86_400_000;

/** A play that ended `daysAgo` days before NOW. */
function row(
  id: number,
  artist: number | null,
  daysAgo: number,
  outcome: number,
  heardS = 200,
  flags = 0,
): PlayRow {
  const positionS = outcome === OUTCOME.skipped || outcome === OUTCOME.rejected ? heardS : 200;
  return [id, artist, NOW - daysAgo * DAY, outcome, heardS, positionS, 200, flags];
}

/** The same play, `times` times, a day apart, starting `from` days ago. */
function plays(
  times: number,
  id: number,
  artist: number | null,
  outcome: number,
  heardS = 200,
  from = 10,
): PlayRow[] {
  return Array.from({ length: times }, (_, i) => row(id, artist, from + i, outcome, heardS));
}

/** Enough ordinary plays elsewhere that what was learned has its say. */
const background = (n: number) =>
  Array.from({ length: n }, (_, i) => row(5000 + i, 99, 20 + (i % 40), OUTCOME.finished));

function learnedInput(rows: PlayRow[], patch: Partial<SelectionInput> = {}): SelectionInput {
  return {
    likes: range(1, 40, (id) => ({ artist: (id % 8) + 1 })),
    history: [],
    pools: [{ source: "stations", tracks: range(101, 160, (id) => ({ artist: (id % 10) + 20 })) }],
    taste: learn(rows, NOW),
    skipped: new Set(),
    mood: "usual",
    seed: 11,
    now: NOW,
    ...patch,
  };
}

const placeIn = (queue: readonly Track[], id: number) => queue.findIndex((t) => t.id === id);

/** Where a track lands on average over many seeds (−1 counts as past the end). */
function averagePlace(make: (seed: number) => SelectionInput, id: number): number {
  let sum = 0;
  for (let seed = 0; seed < 60; seed++) {
    const queue = tracksOf(select(make(seed)));
    const at = placeIn(queue, id);
    sum += at < 0 ? queue.length : at;
  }
  return sum / 60;
}

describe("the selection learns from the diary", () => {
  it("is deterministic for a seed", () => {
    const rows = [...background(40), ...plays(4, 5, 6, OUTCOME.finished)];
    const a = select(learnedInput(rows));
    const b = select(learnedInput(rows));
    expect(ids(tracksOf(a))).toEqual(ids(tracksOf(b)));
    expect(ids(tracksOf(a))).not.toEqual(ids(tracksOf(select(learnedInput(rows, { seed: 12 })))));
  });

  it("brings what you hear to the end forward, and what you leave early back", () => {
    const loved = averagePlace(
      (seed) => learnedInput([...background(60), ...plays(5, 9, 2, OUTCOME.finished)], { seed }),
      9,
    );
    const left = averagePlace(
      (seed) => learnedInput([...background(60), ...plays(1, 9, 2, OUTCOME.skipped, 70)], { seed }),
      9,
    );
    const plain = averagePlace((seed) => learnedInput(background(60), { seed }), 9);
    expect(loved).toBeLessThan(plain);
    expect(left).toBeGreaterThan(plain);
  });

  it("leans on artists: early skips of one artist push all their tracks back", () => {
    // Artist 3 owns likes 2, 10, 18, 26, 34; three of them were left in seconds.
    const rows = [
      ...background(60),
      ...plays(2, 2, 3, OUTCOME.skipped, 6),
      ...plays(2, 10, 3, OUTCOME.skipped, 4, 15),
      ...plays(2, 18, 3, OUTCOME.skipped, 9, 20),
    ];
    const skipped = averagePlace((seed) => learnedInput(rows, { seed }), 26);
    const plain = averagePlace((seed) => learnedInput(background(60), { seed }), 26);
    expect(skipped).toBeGreaterThan(plain + 3);
  });

  it("never offers what was sent away, or left early twice and never heard out", () => {
    const rows = [
      ...background(40),
      row(3, 4, 5, OUTCOME.rejected, 8),
      ...plays(2, 12, 5, OUTCOME.skipped, 5),
      // Left early once, heard out another time: still welcome.
      row(13, 6, 3, OUTCOME.skipped, 5),
      row(13, 6, 9, OUTCOME.finished),
    ];
    const queue = ids(tracksOf(select(learnedInput(rows))));
    expect(queue).not.toContain(3);
    expect(queue).not.toContain(12);
    expect(queue).toContain(13);
  });

  it("keeps what played in the last day back, and off the new side", () => {
    const rows = [
      ...background(40),
      row(6, 7, 0.1, OUTCOME.finished),
      // Heard out an hour ago on the radio: not new, and not again so soon.
      row(105, 25, 0.04, OUTCOME.finished),
    ];
    const queue = ids(tracksOf(select(learnedInput(rows))));
    expect(queue).not.toContain(105);
    const likes = queue.filter((id) => id <= 40);
    expect(likes.at(-1)).toBe(6);
  });

  it("keeps an artist out of the next two places once it has learned", () => {
    const rows = [
      ...background(40),
      ...plays(6, 1, 2, OUTCOME.finished),
      ...plays(6, 9, 2, OUTCOME.finished),
    ];
    const queue = tracksOf(select(learnedInput(rows)));
    for (let i = 1; i < queue.length; i++) {
      const artist = queue[i]?.user?.id;
      const before = [queue[i - 1]?.user?.id, queue[i - 2]?.user?.id];
      if (i < 60) expect(before).not.toContain(artist);
    }
  });

  it("keeps the artist that plays now away from the start of a rebuilt queue", () => {
    const rows = [...background(40), ...plays(6, 1, 2, OUTCOME.finished)];
    const playing = track(1, { artist: 2 });
    const queue = tracksOf(
      select(learnedInput(rows, { before: [playing], exclude: new Set([1]) })),
    );
    expect(queue[0]?.user?.id).not.toBe(2);
    expect(queue[1]?.user?.id).not.toBe(2);
  });

  it("learns gradually: thirty plays give it half the say", () => {
    expect(select(learnedInput(background(30))).learned).toBeCloseTo(0.5);
    expect(select(learnedInput(background(3))).learned).toBeCloseTo(3 / 33);
    expect(select(learnedInput(background(300))).learned).toBeGreaterThan(0.9);
  });
});

// --- the slider and the sources ---------------------------------------------------------

const sides = (input: SelectionInput) =>
  tracksOf(select(input)).map((t) => (t.id > 100 ? "n" : "f"));

describe("familiar ↔ new", () => {
  const settings = (novelty: number): SelectionSettings => ({ ...DEFAULT_SETTINGS, novelty });

  it("one new in three by default, half and half in the middle", () => {
    expect(
      sides(learnedInput([], { settings: settings(4) }))
        .slice(0, 6)
        .join(""),
    ).toBe("ffnffn");
    expect(
      sides(learnedInput([], { settings: settings(6) }))
        .slice(0, 6)
        .join(""),
    ).toBe("fnfnfn");
    // Your own music first: even a mostly new queue opens with something you know.
    expect(
      sides(learnedInput([], { settings: settings(9) }))
        .slice(0, 8)
        .join(""),
    ).toBe("fnnnfnnn");
  });

  it("only the familiar at one end, only the new at the other", () => {
    expect(sides(learnedInput([], { settings: settings(0) }))).toEqual(Array(40).fill("f"));
    expect(sides(learnedInput([], { settings: settings(12) }))).toEqual(Array(60).fill("n"));
  });
});

describe("sources", () => {
  const withSources = (patch: Partial<Record<SourceId, { on?: boolean; weight?: number }>>) => {
    const sources = { ...DEFAULT_SETTINGS.sources };
    for (const [id, value] of Object.entries(patch)) {
      sources[id as SourceId] = { ...sources[id as SourceId], ...value };
    }
    return { ...DEFAULT_SETTINGS, sources };
  };

  it("a source switched off offers nothing", () => {
    const off = select(learnedInput([], { settings: withSources({ stations: { on: false } }) }));
    expect(tracksOf(off).every((t) => t.id <= 40)).toBe(true);
    expect(off.sources.stations.offered).toBe(0);
  });

  it("weights share a side between its sources", () => {
    const rows = [
      ...background(60),
      ...range(301, 340).map((t) => row(t.id, 50, 40, OUTCOME.finished)),
    ];
    const pools: Pool[] = [
      { source: "stations", tracks: range(101, 160, (id) => ({ artist: (id % 10) + 20 })) },
      { source: "history", tracks: range(301, 340, () => ({ artist: 50 })) },
    ];
    // How many of the first twenty-four places history gets.
    const count = (weight: number) =>
      select(learnedInput(rows, { pools, settings: withSources({ history: { weight } }) }))
        .picks.slice(0, 24)
        .filter((p) => p.source === "history").length;
    expect(count(2)).toBeGreaterThan(count(1));
    expect(count(1)).toBeGreaterThan(count(0.5));
  });

  it("history waits for the diary to say what you hear out", () => {
    const pools: Pool[] = [
      { source: "stations", tracks: range(101, 120, () => ({ artist: 20 })) },
      { source: "history", tracks: range(401, 420, (id) => ({ artist: id % 2 ? 60 : 61 })) },
    ];
    const cold = select({ ...learnedInput([], { pools }), taste: null });
    expect(cold.sources.history.offered).toBe(0);
    // Artist 60 is heard out, artist 61 left early: only 60's history comes.
    const rows = [
      ...background(40),
      ...plays(4, 900, 60, OUTCOME.finished),
      ...plays(4, 901, 61, OUTCOME.skipped, 5),
    ];
    const warm = select(learnedInput(rows, { pools }));
    const history = warm.picks.filter((p) => p.source === "history").map((p) => p.track.user?.id);
    expect(history.length).toBeGreaterThan(0);
    expect(new Set(history)).toEqual(new Set([60]));
  });

  it("last winter and a year ago say how often you heard them then", () => {
    const pools: Pool[] = [
      { source: "stations", tracks: range(101, 110, () => ({ artist: 20 })) },
      {
        source: "winter",
        tracks: [track(501, { artist: 70 }), track(502, { artist: 71 })],
        heard: new Map([
          [501, 4],
          [502, 1],
        ]),
      },
      { source: "yearAgo", tracks: [], heard: new Map() },
    ];
    const result = select(learnedInput(background(40), { pools }));
    const winter = result.picks.find((p) => p.track.id === 501);
    expect(winter?.source).toBe("winter");
    expect(winter?.facts).toContainEqual({ kind: "winter", times: 4 });
    expect(result.sources.yearAgo.offered).toBe(0);
  });
});

// --- steering -----------------------------------------------------------------------------

describe("«больше такого» and «не то»", () => {
  const seedTrack = track(150, { artist: 25 });
  const pools: Pool[] = [
    {
      source: "stations",
      seed: { track: track(9, { artist: 2 }), reason: "finished", at: NOW - DAY },
      tracks: range(101, 140, (id) => ({ artist: (id % 10) + 20 })),
    },
  ];
  const base = (patch: Partial<SelectionInput> = {}) =>
    learnedInput(background(40), { pools, ...patch });

  it("«больше такого» brings the artist and the radio from that track forward", () => {
    const morePool: Pool = {
      source: "stations",
      seed: { track: seedTrack, reason: "more", at: NOW },
      tracks: range(201, 230, (id) => ({ artist: (id % 5) + 40 })),
    };
    const before = select(base({ pools: [...pools, morePool] }));
    const after = select(
      base({
        pools: [...pools, morePool],
        steers: [{ kind: "more", track: seedTrack, from: 9, at: NOW }],
        places: before.places,
      }),
    );
    const firstNew = (s: typeof after) =>
      s.picks.filter((p) => p.source === "stations").slice(0, 6);
    const fromMore = firstNew(after).filter(
      (p) => p.seed?.reason === "more" || p.track.user?.id === 25,
    );
    expect(fromMore.length).toBeGreaterThan(
      firstNew(before).filter((p) => p.seed?.reason === "more" || p.track.user?.id === 25).length,
    );
    const asked = after.picks.find((p) => p.seed?.reason === "more");
    expect(asked?.facts[0]).toEqual({ kind: "more", track: seedTrack });
  });

  it("«не то» takes the track out and pushes its artist back", () => {
    const sentAway = track(123, { artist: 23 });
    const steers = [{ kind: "less" as const, track: sentAway, from: 9, at: NOW }];
    const queue = tracksOf(select(base({ steers })));
    expect(ids(queue)).not.toContain(123);
    const artistAt = averagePlace((seed) => base({ steers, seed }), 133);
    const plainAt = averagePlace((seed) => base({ seed }), 133);
    expect(artistAt).toBeGreaterThan(plainAt);
  });

  it("a rebuild with the same places moves only what the press touched", () => {
    const before = select(base());
    const after = select(
      base({
        steers: [{ kind: "less", track: track(123, { artist: 23 }), from: 9, at: NOW }],
        places: before.places,
      }),
    );
    const untouched = (s: typeof before) =>
      s.picks.filter((p) => p.track.user?.id !== 23 && p.source === "likes").map((p) => p.track.id);
    expect(untouched(after)).toEqual(untouched(before));
  });
});

// --- facts --------------------------------------------------------------------------------

describe("facts behind a pick", () => {
  it("names the track a radio grew from and why", () => {
    const seed = { track: track(9, { artist: 2 }), reason: "finished" as const, at: NOW - DAY };
    const result = select(
      learnedInput(background(40), {
        pools: [{ source: "stations", seed, tracks: range(101, 110, () => ({ artist: 30 })) }],
      }),
    );
    const radio = result.picks.find((p) => p.source === "stations");
    expect(radio?.facts).toContainEqual({ kind: "station", seed });
    expect(radio?.facts).toContainEqual({ kind: "stranger" });
  });

  it("counts what you did with a track and its artist", () => {
    const rows = [
      ...background(40),
      ...plays(5, 9, 2, OUTCOME.finished),
      row(9, 2, 30, OUTCOME.skipped, 80),
      row(17, 2, 3, OUTCOME.again),
      row(17, 2, 4, OUTCOME.again),
    ];
    const result = select(learnedInput(rows));
    const nine = result.picks.find((p) => p.track.id === 9);
    expect(nine?.facts).toContainEqual({ kind: "liked" });
    expect(nine?.facts).toContainEqual({ kind: "finished", times: 5, of: 6 });
    expect(nine?.facts).toContainEqual({ kind: "artist", name: "a2", finished: 7, plays: 8 });
    const seventeen = result.picks.find((p) => p.track.id === 17);
    expect(seventeen?.facts).toContainEqual({ kind: "again", times: 2 });
  });

  it("says when a favourite has not been heard for a while", () => {
    const rows = [...background(40), ...plays(3, 9, 2, OUTCOME.finished, 200, 45)];
    const nine = select(learnedInput(rows)).picks.find((p) => p.track.id === 9);
    expect(nine?.facts).toContainEqual({ kind: "missed", at: NOW - 45 * DAY });
  });

  it("reads «больше такого» and likes from the diary's flags", () => {
    const taste = learn(
      [
        row(9, 2, 2, OUTCOME.finished, 200, FLAG.more),
        row(9, 2, 3, OUTCOME.skipped, 100, FLAG.liked),
      ],
      NOW,
    );
    const nine = taste.tracks.get(9);
    expect([nine?.more, nine?.liked, nine?.mid]).toEqual([1, 1, 1]);
  });
});

it("a mood that finds too little says so instead of playing something else", () => {
  const result = select(
    learnedInput(background(40), {
      mood: "calm",
      likes: range(1, 3, () => ({ genre: "Ambient" })),
      pools: [],
    }),
  );
  expect(result.picks.length).toBeLessThan(MIN_MOOD_TRACKS);
  expect(result.picks).toEqual([]);
});
