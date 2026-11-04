// Development only: SoundCloud's search, answered from the stand-in library in
// `backend.ts`, so the search screen works in a plain browser tab. It matches
// words the way a search would, pages by offset, narrows by the same filters
// and counts genres — enough to feel paging, filters and empty states.

import { ApiError } from "@/api/invoke";
import type {
  GenreCount,
  OffsetRequest,
  Playlist,
  Resource,
  SearchPage,
  Suggestion,
  Track,
  TrackFilters,
  User,
} from "@/api/types";
import { fold } from "@/features/library/filter";

export interface SearchPools {
  tracks: Track[];
  users: User[];
  playlists: Playlist[];
}

const NOW = Date.UTC(2026, 10, 3);
const DAY = 86_400_000;
const AGE: Record<string, number> = {
  "last-hour": DAY / 24,
  "last-day": DAY,
  "last-week": 7 * DAY,
  "last-month": 31 * DAY,
  "last-year": 366 * DAY,
};
const SHARE = new Set(["cc-by", "cc-by-sa", "cc-by-nd", "cc-by-nc", "cc-by-nc-sa", "cc-by-nc-nd"]);
const PAID = new Set(["cc-by", "cc-by-sa", "cc-by-nd"]);
const REMIX = new Set(["cc-by", "cc-by-sa"]);

/** How many of the query's words the text holds; 0 is no match. */
function score(text: string, words: readonly string[]): number {
  const folded = fold(text);
  return words.filter((word) => folded.includes(word)).length;
}

function found<T>(items: readonly T[], query: string, text: (item: T) => string): T[] {
  const words = fold(query).split(" ").filter(Boolean);
  return items
    .map((item, order) => ({ item, order, score: score(text(item), words) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((hit) => hit.item);
}

function narrowed(tracks: readonly Track[], filters: TrackFilters = {}): Track[] {
  return tracks.filter((track) => {
    if (filters.genre && fold(track.genre ?? "") !== fold(filters.genre)) return false;
    if (filters.duration) {
      const minutes = track.fullDurationMs / 60_000;
      const band = minutes < 2 ? "short" : minutes < 10 ? "medium" : minutes < 30 ? "long" : "epic";
      if (band !== filters.duration) return false;
    }
    if (filters.created) {
      const age = NOW - Date.parse(track.createdAt ?? "");
      if (!(age <= (AGE[filters.created] ?? 0))) return false;
    }
    if (filters.license) {
      const allowed =
        filters.license === "to-share"
          ? SHARE
          : filters.license === "to-use-commercially"
            ? PAID
            : REMIX;
      if (!allowed.has(track.license ?? "")) return false;
    }
    if (filters.goPlusOnly && !track.access.goPlus) return false;
    return true;
  });
}

function paged<T>(items: readonly T[], page: OffsetRequest | null | undefined): SearchPage<T> {
  const offset = page?.offset ?? 0;
  const limit = Math.min(Math.max(page?.limit ?? 200, 1), 200);
  const end = offset + limit;
  return {
    items: items.slice(offset, end),
    total: items.length,
    nextOffset: end < items.length ? end : null,
  };
}

const trackText = (track: Track) =>
  `${track.title} ${track.user?.username ?? ""} ${track.genre ?? ""}`;
const userText = (user: User) => `${user.username} ${user.fullName ?? ""}`;
const playlistText = (playlist: Playlist) => `${playlist.title} ${playlist.user?.username ?? ""}`;

/** Answers the search commands, or returns `undefined` for any other. */
export function answerSearch(
  pools: SearchPools,
  command: string,
  args: Record<string, unknown>,
): unknown {
  const query = String(args.query ?? "").trim();
  const page = args.page as OffsetRequest | null | undefined;
  const filters = (args.filters ?? {}) as TrackFilters;
  if (command.startsWith("search_") && command !== "search_suggestions" && !query) {
    throw new ApiError("invalid-input", "dev: the search is empty");
  }
  switch (command) {
    case "search_tracks":
      return paged(narrowed(found(pools.tracks, query, trackText), filters), page);
    case "search_track_genres": {
      const counts = new Map<string, number>();
      for (const track of narrowed(found(pools.tracks, query, trackText), {
        ...filters,
        genre: null,
      })) {
        const genre = track.genre?.trim().toLowerCase();
        if (genre) counts.set(genre, (counts.get(genre) ?? 0) + 1);
      }
      return [...counts]
        .map(([genre, count]): GenreCount => ({ genre, count }))
        .sort((a, b) => b.count - a.count);
    }
    case "search_users":
      return paged(found(pools.users, query, userText), page);
    case "search_playlists":
      return paged(found(pools.playlists, query, playlistText), page);
    case "search_albums":
      return paged(
        found(
          pools.playlists.filter((p) => p.isAlbum),
          query,
          playlistText,
        ),
        page,
      );
    case "search_all": {
      // SoundCloud's own order: the best people first, then mostly tracks.
      const users = found(pools.users, query, userText);
      const tracks = found(pools.tracks, query, trackText);
      const sets = found(pools.playlists, query, playlistText);
      const mixed: Resource[] = [];
      for (let i = 0; mixed.length < 200 && (i < tracks.length || i < users.length); i++) {
        const user = users[i];
        if (user && i < 2) mixed.push({ kind: "user", ...user });
        const track = tracks[i];
        if (track) mixed.push({ kind: "track", ...track });
        const set = sets[i];
        if (set && i % 3 === 2) mixed.push({ kind: "playlist", ...set });
      }
      return paged(mixed, page);
    }
    case "search_suggestions": {
      const typed = fold(query);
      if (!typed) return [];
      // Like SoundCloud's: names and «artist title», not every re-upload's spelling.
      const lines = new Set<string>();
      for (const user of pools.users) lines.add(user.username.toLowerCase());
      for (const track of pools.tracks) {
        const title = track.title.replace(/\s*([([—].*)?$/, "").toLowerCase();
        if (title.includes(" - ")) continue;
        lines.add(title);
        if (track.user) lines.add(`${track.user.username.toLowerCase()} ${title}`);
      }
      const limit = Number(args.limit ?? 8);
      const starts = [...lines].filter((line) => fold(line).startsWith(typed));
      const inside = [...lines].filter(
        (line) => !fold(line).startsWith(typed) && fold(line).includes(` ${typed}`),
      );
      return [...starts, ...inside]
        .slice(0, limit)
        .map((line): Suggestion => ({ output: line, query: line }));
    }
    default:
      return undefined;
  }
}
