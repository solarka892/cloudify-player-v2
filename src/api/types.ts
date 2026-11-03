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

export interface PlayedTrack {
  playedAt: string | null;
  track: Track;
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
  | "app";
