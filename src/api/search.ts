import { call } from "@/api/invoke";
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

/** Everything at once, in SoundCloud's own order. */
export function searchAll(query: string, page?: OffsetRequest): Promise<SearchPage<Resource>> {
  return call<SearchPage<Resource>>("search_all", { query, page: page ?? null });
}

/** Tracks, narrowed by `filters`. */
export function searchTracks(
  query: string,
  filters?: TrackFilters,
  page?: OffsetRequest,
): Promise<SearchPage<Track>> {
  return call<SearchPage<Track>>("search_tracks", {
    query,
    filters: filters ?? null,
    page: page ?? null,
  });
}

/** The genres among the tracks found, most first; counted without the chosen genre. */
export function searchTrackGenres(query: string, filters?: TrackFilters): Promise<GenreCount[]> {
  return call<GenreCount[]>("search_track_genres", { query, filters: filters ?? null });
}

export function searchUsers(query: string, page?: OffsetRequest): Promise<SearchPage<User>> {
  return call<SearchPage<User>>("search_users", { query, page: page ?? null });
}

/** Playlists, albums included (`isAlbum` tells them apart). */
export function searchPlaylists(
  query: string,
  page?: OffsetRequest,
): Promise<SearchPage<Playlist>> {
  return call<SearchPage<Playlist>>("search_playlists", { query, page: page ?? null });
}

export function searchAlbums(query: string, page?: OffsetRequest): Promise<SearchPage<Playlist>> {
  return call<SearchPage<Playlist>>("search_albums", { query, page: page ?? null });
}

/** What people search for that starts like `query`. */
export function searchSuggestions(query: string, limit?: number): Promise<Suggestion[]> {
  return call<Suggestion[]>("search_suggestions", { query, limit: limit ?? null });
}
