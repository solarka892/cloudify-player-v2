// TypeScript twins of the `soundcloud` crate's models and of the shapes the
// Tauri commands return. Rust serializes camelCase keys and kebab-case enum
// values; `Option` arrives as `null`. Change one side, change the other.

export interface User {
  id: number;
  urn: string;
  username: string;
  fullName: string | null;
  permalinkUrl: string | null;
  /** `null` instead of SoundCloud's grey default picture. */
  avatarUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  city: string | null;
  countryCode: string | null;
  followersCount: number | null;
  followingsCount: number | null;
  trackCount: number | null;
  playlistCount: number | null;
  likesCount: number | null;
  verified: boolean;
}

export type Plan = "free" | "go" | "go-plus" | "dj" | "other";

export interface Me {
  user: User;
  plan: Plan;
}

export type Policy = "allow" | "monetize" | "block" | "snip" | "unknown";

export type Monetization =
  | "not-applicable"
  | "ad-supported"
  | "sub-high-tier"
  | "blackbox"
  | "unknown";

export interface TrackAccess {
  policy: Policy;
  monetization: Monetization;
  goPlus: boolean;
  /** Only a 30-second preview plays for this account. */
  preview: boolean;
  /** SoundCloud offers a stream this app can play (not only DRM-encrypted ones). */
  playable: boolean;
}

export interface Track {
  id: number;
  urn: string;
  title: string;
  permalinkUrl: string | null;
  /** Falls back to the uploader's avatar. */
  artworkUrl: string | null;
  /** What actually plays: 30 000 for a Go+ preview. */
  durationMs: number;
  /** The whole song's length, preview or not. */
  fullDurationMs: number;
  user: User | null;
  genre: string | null;
  tags: string[];
  description: string | null;
  createdAt: string | null;
  playbackCount: number | null;
  likesCount: number | null;
  repostsCount: number | null;
  commentCount: number | null;
  waveformUrl: string | null;
  access: TrackAccess;
  downloadable: boolean;
  license: string | null;
  labelName: string | null;
  purchaseUrl: string | null;
  purchaseTitle: string | null;
  private: boolean;
}

export interface Playlist {
  id: number;
  urn: string;
  title: string;
  permalinkUrl: string | null;
  artworkUrl: string | null;
  isAlbum: boolean;
  user: User | null;
  trackCount: number;
  durationMs: number;
  private: boolean;
  createdAt: string | null;
  likesCount: number | null;
  repostsCount: number | null;
  description: string | null;
  genre: string | null;
  tags: string[];
  /** Up to four artworks of its first tracks, for a mosaic. */
  covers: string[];
  /** Only on a single playlist fetched whole, never in lists. */
  tracks?: Track[];
}

export interface LikedTrack {
  likedAt: string | null;
  track: Track;
}

export interface LikedPlaylist {
  likedAt: string | null;
  playlist: Playlist;
}

export interface PlayedTrack {
  playedAt: string | null;
  track: Track;
}

/** A track or a playlist, told apart by `kind`. */
export type TrackOrPlaylist = ({ kind: "track" } & Track) | ({ kind: "playlist" } & Playlist);

export interface Repost {
  repostedAt: string | null;
  caption: string | null;
  item: TrackOrPlaylist;
}

/** One page of a cursor-paged list. `next` is opaque: pass it back as `cursor`. */
export interface Page<T> {
  items: T[];
  next: string | null;
}

export interface PageRequest {
  limit?: number;
  cursor?: string;
}

/** One page of search results; pass `nextOffset` back as `offset` for the next. */
export interface SearchPage<T> {
  items: T[];
  /** SoundCloud's estimate of all matches. */
  total: number | null;
  /** `null` at the end. */
  nextOffset: number | null;
}

export interface OffsetRequest {
  offset?: number;
  /** Items per page, clamped to 1…200. */
  limit?: number;
}

/** Anything the mixed search can return, told apart by `kind`. */
export type Resource =
  | ({ kind: "track" } & Track)
  | ({ kind: "user" } & User)
  | ({ kind: "playlist" } & Playlist);

/** An autocomplete line: `output` to show, `query` to search for. */
export interface Suggestion {
  output: string;
  query: string;
}

/** Under 2 minutes, 2–10, 10–30, over 30. */
export type DurationFilter = "short" | "medium" | "long" | "epic";

export type CreatedWithin = "last-hour" | "last-day" | "last-week" | "last-month" | "last-year";

/** What the licence allows. */
export type LicenseFilter = "to-share" | "to-use-commercially" | "to-modify-commercially";

/** Narrows a track search, as the website's filters do; unset narrows nothing. */
export interface TrackFilters {
  /** Any case; SoundCloud matches it lowercased. */
  genre?: string | null;
  duration?: DurationFilter | null;
  created?: CreatedWithin | null;
  license?: LicenseFilter | null;
  goPlusOnly?: boolean;
}

/** How many of the tracks a search finds carry a genre (lowercase). */
export interface GenreCount {
  genre: string;
  count: number;
}

export interface Stream {
  /** Signed and short-lived: resolve right before playing, never keep. */
  url: string;
  protocol: "progressive" | "hls";
  mimeType: string;
  preview: boolean;
}

/** A track's loudness outline: `samples` are bar heights from 0 to `height`. */
export interface Waveform {
  width: number;
  height: number;
  samples: number[];
}

export type SessionState =
  | { state: "signed-out" }
  | { state: "expired" }
  | { state: "signed-in"; me: Me };

/** `ErrorKind` from the crate, plus the app's own kinds. */
export type ErrorKind =
  | "network"
  | "unauthorized"
  | "sign-in-required"
  | "bot-filtered"
  | "forbidden"
  | "not-found"
  | "rate-limited"
  | "not-available"
  | "client-id"
  | "invalid-input"
  | "decode"
  | "api"
  | "keychain"
  | "storage"
  | "app";

// --- the listening diary (crates/diary) -------------------------------------------

/** Where a play came from: the player's queue source, as the diary keeps it. */
export interface PlaySource {
  kind:
    | "selection"
    | "likes"
    | "playlist"
    | "history"
    | "reposts"
    | "artist"
    | "station"
    | "search"
    | "resume"
    | "other";
  /** A playlist's title, the search query, the artist. */
  title: string | null;
  /** A playlist's id. */
  id: number | null;
}

/**
 * How a play ended: to the end; left for another track; left with «не то»;
 * started over (on repeat, or sent back to its start); stopped without moving
 * on (the app closed, the track broke off).
 */
export type PlayOutcome = "finished" | "skipped" | "rejected" | "again" | "stopped";

/** The part of the day by the clock: 0–6, 6–12, 12–18, 18–24. */
export type PartOfDay = "night" | "morning" | "day" | "evening";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type Season = "winter" | "spring" | "summer" | "autumn";

/** The setting a play started in. Every key is always there; what is not known is `null`. */
export interface PlaySetting {
  tod: PartOfDay | null;
  dow: Weekday | null;
  season: Season | null;
  /** Hours from sunrise to sunset that day, to a tenth. */
  daylight: number | null;
  /** The sun's height in whole degrees: below 0 after sunset, below −6 dark. */
  sun: number | null;
  /** The latitude those were worked out for. */
  lat: number | null;
  /** A city the person named, or their time zone's. */
  place: "city" | "zone" | null;
  /** Not recorded yet: `null` until the app learns to ask. */
  weather: unknown;
  activity: unknown;
  mood: unknown;
}

/** One play, as the diary keeps it. */
export interface Play {
  id: number;
  /** The track as the app showed it when it last played. */
  track: Track;
  /** When the sound started, in milliseconds since 1970. */
  startedAt: number;
  /** Minutes the clock ran ahead of UTC then: the day and hour it was there. */
  utcOffset: number;
  endedAt: number | null;
  /** `null` while it plays. */
  outcome: PlayOutcome | null;
  fromMs: number;
  positionMs: number;
  /** Sound really heard: seeking past a part does not count. */
  listenedMs: number;
  durationMs: number;
  /** Liked while it played. */
  liked: boolean;
  source: PlaySource;
  /** Put next by hand («Играть следующим»). */
  added: boolean;
  setting: PlaySetting;
}

/** Plays newest first; pass `next` back as `before` for older ones. */
export interface DiaryPage {
  items: Play[];
  next: string | null;
}

/** How far a play got. */
export interface Heard {
  positionMs: number;
  listenedMs: number;
}

/** A city the sun is worked out for, to a tenth of a degree. */
export interface DiaryCity {
  name: string;
  lat: number;
  lon: number;
}

/** The city a time zone is named after (`Europe/Moscow`), standing in until a city is named. */
export interface ZoneCity {
  zone: string;
  lat: number;
  lon: number;
}

export interface DiarySettings {
  /** Plays older than this are let go; `null` keeps them all. */
  keepDays: number | null;
  city: DiaryCity | null;
  zone: ZoneCity | null;
  /** How many plays are kept. */
  plays: number;
  /** When the oldest kept play started. */
  since: number | null;
}
