import { call } from "@/api/invoke";
import type { LikedTrack, Page, PageRequest, PlayedTrack, Playlist } from "@/api/types";

/** The signed-in user's likes, latest first. */
export function myLikes(page?: PageRequest): Promise<Page<LikedTrack>> {
  return call<Page<LikedTrack>>("my_likes", { page: page ?? null });
}

/** The signed-in user's own playlists (albums have their own list). */
export function myPlaylists(page?: PageRequest): Promise<Page<Playlist>> {
  return call<Page<Playlist>>("my_playlists", { page: page ?? null });
}

/** What was played on SoundCloud, latest first, each track once per page. */
export function playHistory(page?: PageRequest): Promise<Page<PlayedTrack>> {
  return call<Page<PlayedTrack>>("play_history", { page: page ?? null });
}

/** One playlist with every track, complete and in order. */
export function playlist(id: number): Promise<Playlist> {
  return call<Playlist>("playlist", { id });
}
