import { call } from "@/api/invoke";
import type {
  LikedPlaylist,
  LikedTrack,
  Page,
  PageRequest,
  PlayedTrack,
  Playlist,
  Repost,
  User,
} from "@/api/types";

/** The signed-in user's likes, latest first. */
export function myLikes(page?: PageRequest): Promise<Page<LikedTrack>> {
  return call<Page<LikedTrack>>("my_likes", { page: page ?? null });
}

/** The signed-in user's own playlists (albums have their own list). */
export function myPlaylists(page?: PageRequest): Promise<Page<Playlist>> {
  return call<Page<Playlist>>("my_playlists", { page: page ?? null });
}

/** The signed-in user's own albums. */
export function myAlbums(page?: PageRequest): Promise<Page<Playlist>> {
  return call<Page<Playlist>>("my_albums", { page: page ?? null });
}

/** Playlists and albums the user liked, latest like first; `isAlbum` tells them apart. */
export function myLikedPlaylists(page?: PageRequest): Promise<Page<LikedPlaylist>> {
  return call<Page<LikedPlaylist>>("my_liked_playlists", { page: page ?? null });
}

/** Tracks and playlists the user reposted, latest first. */
export function myReposts(page?: PageRequest): Promise<Page<Repost>> {
  return call<Page<Repost>>("my_reposts", { page: page ?? null });
}

/** The people the user follows. */
export function myFollowings(page?: PageRequest): Promise<Page<User>> {
  return call<Page<User>>("my_followings", { page: page ?? null });
}

/** Likes a track. May be refused by SoundCloud's bot filter (`bot-filtered`). */
export function likeTrack(trackId: number): Promise<void> {
  return call<void>("like_track", { trackId });
}

/** Takes a like back. May be refused the same way. */
export function unlikeTrack(trackId: number): Promise<void> {
  return call<void>("unlike_track", { trackId });
}

/** What was played on SoundCloud, latest first, each track once per page. */
export function playHistory(page?: PageRequest): Promise<Page<PlayedTrack>> {
  return call<Page<PlayedTrack>>("play_history", { page: page ?? null });
}

/** One playlist with every track, complete and in order. */
export function playlist(id: number): Promise<Playlist> {
  return call<Playlist>("playlist", { id });
}
