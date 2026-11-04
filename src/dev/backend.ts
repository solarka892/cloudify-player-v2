// Development only: answers the Rust commands in a plain browser tab
// (`pnpm dev` without Tauri), so screens can be built and checked in a browser.
// Production builds never include this file (see `call` in src/api/invoke.ts).
// The content is public SoundCloud data standing in for a real library; audio
// is generated silence of the right length, since the browser has no backend.
//
// `?signed-out` shows the sign-in screen, `?offline` the unreachable one.
// `?fail=…` breaks commands on purpose, to see how the app tells it: see `planned`.

import { ApiError } from "@/api/invoke";
import type {
  LikedTrack,
  Me,
  Page,
  PageRequest,
  Playlist,
  Repost,
  SessionState,
  Stream,
  Track,
  User,
  Waveform,
} from "@/api/types";
import { answerSearch, type SearchPools } from "@/dev/search";

const art = (key: string, ext = "jpg") => `https://i1.sndcdn.com/artworks-${key}-large.${ext}`;

function user(id: number, username: string, avatarUrl: string | null = null): User {
  return {
    id,
    urn: `soundcloud:users:${id}`,
    username,
    fullName: null,
    permalinkUrl: null,
    avatarUrl,
    bannerUrl: null,
    description: null,
    city: null,
    countryCode: null,
    followersCount: null,
    followingsCount: null,
    trackCount: null,
    playlistCount: 24,
    likesCount: 1312,
    verified: false,
  };
}

const artists = {
  bicep: user(11, "Bicep"),
  kateNv: user(12, "Kate NV"),
  depo: user(13, "Boulevard Depo"),
  pyro: user(14, "pyrokinesis"),
  skrip: user(15, "Скриптонит"),
  ugly: user(16, "uglyhot, Boulevard Depo"),
  basta: user(17, "Баста"),
  radiohead: user(18, "Radiohead"),
  molchat: user(19, "Molchat Doma"),
};

function track(
  id: number,
  title: string,
  by: User,
  length: string,
  artwork: string,
  extra: Partial<Track> & { blocked?: boolean; preview?: boolean } = {},
): Track {
  const [m = 0, s = 0] = length.split(":").map(Number);
  const full = (m * 60 + s) * 1000;
  const { blocked = false, preview = false, ...rest } = extra;
  return {
    id,
    urn: `soundcloud:tracks:${id}`,
    title,
    permalinkUrl: null,
    artworkUrl: art(artwork),
    durationMs: preview ? 30_000 : full,
    fullDurationMs: full,
    user: by,
    genre: null,
    tags: [],
    description: null,
    createdAt: null,
    playbackCount: null,
    likesCount: null,
    repostsCount: null,
    commentCount: null,
    waveformUrl: `https://wave.sndcdn.com/dev-${id}_m.json`,
    access: {
      policy: blocked ? "block" : preview ? "snip" : "allow",
      monetization: preview ? "sub-high-tier" : "not-applicable",
      goPlus: preview,
      preview,
      playable: true,
    },
    downloadable: false,
    license: null,
    labelName: null,
    purchaseUrl: null,
    purchaseTitle: null,
    private: false,
    ...rest,
  };
}

const likes: Track[] = [
  track(
    1157075890,
    "Я приду к тебе с клубникой в декабре",
    artists.pyro,
    "4:38",
    "tMtnogJ13ahHaIuz-zZIylw",
    { genre: "Rap" },
  ),
  track(2235859844, "Кинолента", artists.basta, "4:23", "rK3zytIUgWUccplA-XRpGIg", {
    genre: "Hip-hop",
  }),
  track(268859298, "Weird Fishes / Arpeggi", artists.radiohead, "5:18", "mh2YnflSFifI-0", {
    preview: true,
    genre: "Rock",
    artworkUrl: art("mh2YnflSFifI-0", "png"),
  }),
  track(1046812042, "ZATOICHI", artists.depo, "3:16", "zqBLxK2rN5bMyQOA-0SXiXA", { blocked: true }),
  track(1046814586, "5 минут назад", artists.depo, "3:41", "f2ywWgsyWsuVlQR4-Pf6iqQ", {
    genre: "Phonk",
  }),
  track(902162737, "Apricots", artists.bicep, "4:06", "hNuUXFWIn2orCPpz-KxrAew", {
    genre: "House",
  }),
  track(799094530, "дуб OAK", artists.kateNv, "4:00", "6Ih5lAneoFyf-0", { genre: "Ambient" }),
  track(945810496, "Kromka", artists.depo, "2:35", "2qcvskIny3P1R31e-liLjiw", { genre: "Trap" }),
  track(1139331064, "Цветами радуги", artists.pyro, "4:00", "NkbCzjSMIy4B8wk4-fEk2cA"),
  track(935029318, "Положение", artists.skrip, "4:42", "yy5pjBQFqz21laEM-TEux4g", {
    genre: "Hip-hop",
  }),
  track(2424259065, "АЧЧА", artists.ugly, "2:18", "cUfq96L5WULULXPJ-v4vwtw", { genre: "Phonk" }),
];

const played = track(
  496612449,
  "судно (Борис Рыжий)",
  artists.molchat,
  "2:22",
  "000401307783-p9er1e",
  {
    genre: "Post-punk",
  },
);

// The stand-in artists have no pictures of their own: lend them a cover each.
for (const liked of likes) {
  if (liked.user && !liked.user.avatarUrl) liked.user.avatarUrl = liked.artworkUrl;
}

const radio = user(20, "Станция SoundCloud");

/**
 * A big library, the size of the author's: the stand-in likes over and over
 * under new ids, liked a day apart going back years. Enough to feel paging,
 * the windowed list and the filter the way a real account does.
 */
const LIBRARY_SIZE = 1312;
const allLikes: LikedTrack[] = Array.from({ length: LIBRARY_SIZE }, (_, i) => {
  const base = likes[i % likes.length] as Track;
  const copy = i < likes.length ? base : { ...base, id: base.id * 10 + i, urn: `${base.urn}-${i}` };
  return {
    likedAt: new Date(Date.UTC(2026, 10, 3) - i * 86_400_000 * 1.3).toISOString(),
    track: copy,
  };
});
const station: Track[] = [
  track(799094587, "Похожий трек 1", radio, "3:48", "2NtS3vNB8BrD-0", { genre: "Electronic" }),
  track(2194656115, "Похожий трек 2", radio, "3:12", "qxQGZJ1fRxnQ6Qui-8MIgjg", {
    genre: "Post-punk",
  }),
  track(253792840, "Похожий трек 3", radio, "2:51", "000152760858-gios79", { genre: "Ambient" }),
  track(940952896, "Похожий трек 4", radio, "4:05", "fIyU231zLp5SUYfA-y4f7Sw", {
    genre: "Synth-pop",
  }),
  track(1394754046, "Похожий трек 5", radio, "3:33", "BD8r4Zlg1zZJ76sO-yEd0LA", { genre: "Rock" }),
  track(1779261945, "Похожий трек 6", radio, "2:58", "MjyyzhDjzyz162hP-hi809Q", { genre: "Phonk" }),
];

const covers = (keys: string[]) => keys.map((key) => art(key).replace("-large", "-t500x500"));

function playlist(id: number, title: string, count: number, keys: string[]): Playlist {
  return {
    id,
    urn: `soundcloud:playlists:${id}`,
    title,
    permalinkUrl: null,
    artworkUrl: art(keys[0] ?? ""),
    isAlbum: false,
    user: null,
    trackCount: count,
    durationMs: count * 200_000,
    private: false,
    createdAt: null,
    likesCount: null,
    repostsCount: null,
    description: null,
    genre: null,
    tags: [],
    covers: covers(keys),
  };
}

const playlists: Playlist[] = [
  playlist(1, "ночь на 14-е", 38, [
    "EG4dwznPj88NkhfW-e4P1NA",
    "000401307828-xmmzyc",
    "000152760858-gios79",
    "fIyU231zLp5SUYfA-y4f7Sw",
  ]),
  playlist(2, "фонк в зал", 64, [
    "MjyyzhDjzyz162hP-hi809Q",
    "i5clKUgr20uW-0",
    "BD8r4Zlg1zZJ76sO-yEd0LA",
    "2qcvskIny3P1R31e-liLjiw",
  ]),
];

const playlistsLiked: Playlist[] = [
  {
    ...playlist(3, "Ночной эфир", 112, [
      "000152760858-gios79",
      "2NtS3vNB8BrD-0",
      "qxQGZJ1fRxnQ6Qui-8MIgjg",
      "fIyU231zLp5SUYfA-y4f7Sw",
    ]),
    user: artists.kateNv,
  },
  {
    ...playlist(4, "Этажи", 9, ["zqBLxK2rN5bMyQOA-0SXiXA", "f2ywWgsyWsuVlQR4-Pf6iqQ"]),
    user: artists.depo,
    isAlbum: true,
    createdAt: "2021-09-17T00:00:00Z",
  },
  {
    ...playlist(5, "In Rainbows", 10, ["mh2YnflSFifI-0"]),
    user: artists.radiohead,
    isAlbum: true,
    createdAt: "2007-10-10T00:00:00Z",
  },
];

const me: Me = {
  user: user(1, "solarka", "https://i1.sndcdn.com/avatars-iQdloPteC4sCvuuB-1thxeg-large.jpg"),
  plan: "free",
};

const page = <T>(items: T[]): Page<T> => ({ items, next: null });

/** Pages `items` like SoundCloud does, with an opaque cursor for the next page. */
function paged<T>(name: string, items: T[], request: unknown): Page<T> {
  const asked = (request ?? {}) as PageRequest;
  const from = asked.cursor ? Number(asked.cursor.split(":")[1]) : 0;
  const size = Math.min(asked.limit ?? 200, 200);
  const to = from + size;
  return { items: items.slice(from, to), next: to < items.length ? `${name}:${to}` : null };
}
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

function waveformFor(url: string): Waveform {
  let seed = [...url].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0, 7);
  const random = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    return seed / 2 ** 32;
  };
  const samples = Array.from({ length: 1800 }, (_, i) => {
    const u = i / 1800;
    const shape = Math.min(1, u * 12) * Math.min(1, (1 - u) * 18);
    const verse = 0.75 + 0.25 * Math.sin(u * Math.PI * 7 + (seed % 5));
    return Math.round(140 * shape * verse * (0.82 + 0.18 * random()));
  });
  return { width: 1800, height: 140, samples };
}

/** Silence of the track's length, so the player really runs in a browser. */
function silence(seconds: number): string {
  const rate = 4000;
  const length = Math.round(Math.min(seconds, 360) * rate);
  const bytes = new Uint8Array(44 + length);
  const view = new DataView(bytes.buffer);
  const text = (at: number, value: string) => {
    for (const [i, c] of [...value].entries()) bytes[at + i] = c.charCodeAt(0);
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + length, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, "data");
  view.setUint32(40, length, true);
  bytes.fill(128, 44);
  return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
}

// Search: the stand-ins, each with the re-uploads a real search turns up
// («artist - title (slowed)»), and a few house mixes for a genre query.
const reuploaders = [
  user(31, "music archive"),
  user(32, "slowed + reverb"),
  user(33, "Русская Рэп-Сцена"),
  user(34, "nightdrive"),
];
const houseSessions = user(41, "Deep House Sessions", art("2NtS3vNB8BrD-0"));
const houseMixes = [
  track(3001, "Deep House Mix 2026", houseSessions, "58:20", "2NtS3vNB8BrD-0", {
    genre: "Deep House",
  }),
  track(3002, "Sunset Session — deep house", houseSessions, "12:40", "qxQGZJ1fRxnQ6Qui-8MIgjg", {
    genre: "Deep House",
  }),
  track(
    3003,
    "Night Drive (Deep House Edit)",
    reuploaders[3] as User,
    "6:05",
    "000152760858-gios79",
    {
      genre: "House",
    },
  ),
];
const VERSIONS = [
  "",
  " (slowed)",
  " (sped up)",
  " (live)",
  " (remix)",
  " (acoustic)",
  " (instrumental)",
  " [HQ]",
  " — radio edit",
  " (cover)",
];
const searchTracks: Track[] = [...likes, played, ...station, ...houseMixes].flatMap((base, j) =>
  VERSIONS.map((version, k): Track => {
    const reupload = k > 0 && (j + k) % 3 !== 0;
    const length = k === 3 ? Math.round(base.fullDurationMs * 1.6) : base.fullDurationMs;
    return {
      ...base,
      id: base.id * 10 + k,
      urn: `${base.urn}-${k}`,
      title: reupload
        ? `${base.user?.username} - ${base.title}${version}`
        : `${base.title}${version}`,
      user: reupload ? (reuploaders[(j + k) % reuploaders.length] as User) : base.user,
      createdAt: new Date(Date.UTC(2026, 10, 3) - (j * 37 + k * 113) * 28_800_000).toISOString(),
      playbackCount: Math.round(1_200_000 / (1 + k * 3 + j)),
      license: k % 5 === 3 ? "cc-by" : k % 7 === 6 ? "cc-by-nc" : "all-rights-reserved",
      fullDurationMs: length,
      durationMs: base.access.preview ? 30_000 : length,
    };
  }),
);
const FOLLOWING: Record<number, [number, boolean]> = {
  11: [412_000, true],
  12: [21_300, false],
  13: [120_400, true],
  14: [34_842, true],
  15: [256_000, true],
  16: [9_100, false],
  17: [301_000, true],
  18: [1_840_000, true],
  19: [58_444, true],
  41: [114_207, true],
};
const searchPools: SearchPools = {
  tracks: searchTracks,
  users: [...Object.values(artists), ...reuploaders, houseSessions].map((a) => ({
    ...a,
    followersCount: FOLLOWING[a.id]?.[0] ?? 40 + a.id * 3,
    verified: FOLLOWING[a.id]?.[1] ?? false,
    trackCount: 12 + (a.id % 9) * 17,
  })),
  playlists: [
    ...playlists,
    ...playlistsLiked,
    {
      ...playlist(6, "Deep House 2026", 74, [
        "2NtS3vNB8BrD-0",
        "qxQGZJ1fRxnQ6Qui-8MIgjg",
        "000152760858-gios79",
        "fIyU231zLp5SUYfA-y4f7Sw",
      ]),
      user: houseSessions,
    },
  ],
};

const everything = [...allLikes.map((like) => like.track), played, ...station, ...searchTracks];

// --- breaking on purpose ----------------------------------------------------------

/** Commands a `*` leaves alone: without them the app could not sign in at all. */
const NEVER_BROKEN = new Set(["sign_in_with_window", "sign_in_with_token", "sign_out"]);

/**
 * How a command should fail, if it should: `?fail=my_playlists:api,like_track:bot-filtered`
 * in the address, or the same list in `localStorage["cloudify.dev.fail"]` (read on
 * every call, so it can change while the app runs). `*` is every command; the kind
 * is an `ErrorKind`, or `shape` for an answer the screen does not expect.
 */
function planned(command: string): string | null {
  let rules = new URLSearchParams(location.search).get("fail") ?? "";
  try {
    rules = localStorage.getItem("cloudify.dev.fail") ?? rules;
  } catch {
    // Storage can be off; the address still works.
  }
  for (const rule of rules.split(",")) {
    const [name, kind = "api"] = rule.trim().split(":");
    if (name === command || (name === "*" && !NEVER_BROKEN.has(command))) return kind;
  }
  return null;
}

/** What SoundCloud (or its absence) would have said, as the Rust side reports it. */
function failure(kind: string): ApiError {
  switch (kind) {
    case "network":
      return new ApiError(
        "network",
        "network error: error sending request: client error (Connect): dns error: failed to lookup address information (dev)",
      );
    case "unauthorized":
      return new ApiError(
        "unauthorized",
        "SoundCloud refused the session (expired or revoked)",
        401,
      );
    case "bot-filtered":
      return new ApiError(
        "bot-filtered",
        "SoundCloud's bot protection (DataDome) refused the request",
        403,
      );
    case "rate-limited":
      return new ApiError("rate-limited", "SoundCloud is rate limiting this client", 429, 20);
    case "forbidden":
      return new ApiError("forbidden", "SoundCloud refused access", 403);
    case "not-found":
      return new ApiError("not-found", "not found on SoundCloud", 404);
    case "decode":
      return new ApiError(
        "decode",
        "unexpected reply: /me/track_likes: missing field `collection`",
      );
    case "client-id":
      return new ApiError("client-id", "no working client_id: none of the scripts carried one");
    default:
      return new ApiError(
        "api",
        "SoundCloud answered 502: <html> <head><title>502 Bad Gateway</title></head> <body> <center><h1>502 Bad Gateway</h1></center> </body> </html>",
        502,
      );
  }
}

/** A page with a hole in it, the way a changed SoundCloud answer would trip a screen. */
function broken(answer: unknown): unknown {
  if (typeof answer !== "object" || answer === null || !("items" in answer)) return answer;
  const page = answer as { items: unknown[] };
  return { ...page, items: [null, ...page.items] };
}

export async function answer(
  command: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const plan = planned(command);
  if (plan === null || plan === "shape") {
    const real = await standIn(command, args);
    return plan === "shape" ? broken(real) : real;
  }
  await wait(250);
  if (command === "session") {
    // As the Rust side does: a refused token is a state, not an error.
    if (plan === "unauthorized") return { state: "expired" } satisfies SessionState;
    if (plan !== "network") return standIn(command, args);
  }
  throw failure(plan);
}

async function standIn(command: string, args: Record<string, unknown>): Promise<unknown> {
  await wait(250);
  const query = new URLSearchParams(location.search);
  switch (command) {
    case "session": {
      if (query.has("offline")) throw new ApiError("network", "dev: offline");
      const state: SessionState = query.has("signed-out")
        ? { state: query.get("signed-out") === "expired" ? "expired" : "signed-out" }
        : { state: "signed-in", me };
      return state;
    }
    case "sign_in_with_window":
      await wait(1500);
      return me;
    case "sign_in_with_token":
      return me;
    case "sign_out":
      return null;
    case "my_likes":
      return paged("likes", allLikes, args.page);
    case "my_albums":
      return page<Playlist>([]);
    case "my_liked_playlists":
      return page(playlistsLiked.map((p) => ({ likedAt: null, playlist: p })));
    case "my_reposts": {
      const reposts: Repost[] = [
        { repostedAt: null, caption: null, item: { kind: "track", ...(likes[6] as Track) } },
        { repostedAt: null, caption: null, item: { kind: "track", ...(likes[1] as Track) } },
        {
          repostedAt: null,
          caption: null,
          item: { kind: "playlist", ...(playlistsLiked[0] as Playlist) },
        },
      ];
      return page(reposts);
    }
    case "my_followings":
      return page(
        Object.values(artists).map((a) => ({ ...a, followersCount: 1000 + a.id * 7919 })),
      );
    case "artist_top_tracks":
      return page(
        likes
          .filter((t) => t.user?.id === args.userId)
          .concat(station)
          .slice(0, 12),
      );
    case "artist_station":
      return station;
    case "like_track":
    case "unlike_track":
      return null;
    case "play_history":
      return page(
        [played, likes[5] as Track].map((t) => ({
          playedAt: new Date(Date.now() - 86_400_000).toISOString(),
          track: t,
        })),
      );
    case "my_playlists":
      return page(playlists);
    case "playlist": {
      const found = [...playlists, ...playlistsLiked].find((p) => p.id === args.id);
      if (!found) throw new ApiError("not-found", "dev: no such playlist");
      // As many tracks as the playlist says it has, so an opened one looks its real size.
      const pool = [...station, ...likes];
      return {
        ...found,
        tracks: Array.from({ length: found.trackCount }, (_, i) => pool[i % pool.length] as Track),
      };
    }
    case "track_station":
      return station;
    case "waveform":
      return waveformFor(String(args.url));
    case "stream": {
      const found = everything.find((t) => t.id === args.trackId);
      if (!found) throw new ApiError("not-available", "dev: unknown track");
      const stream: Stream = {
        url: silence(found.durationMs / 1000),
        protocol: "progressive",
        mimeType: "audio/wav",
        preview: found.access.preview,
      };
      return stream;
    }
    default: {
      const searched = answerSearch(searchPools, command, args);
      if (searched !== undefined) return searched;
      throw new ApiError("app", `dev backend: no stand-in for ${command}`);
    }
  }
}
