import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  myAlbums,
  myFollowings,
  myLikedPlaylists,
  myLikes,
  myPlaylists,
  myReposts,
  playHistory,
  playlist,
} from "@/api/library";
import { artistTopTracks } from "@/api/people";
import type { LikedPlaylist, PlayedTrack, Repost } from "@/api/types";
import { useWholeList } from "@/features/library/useWholeList";

// The signed-in user's library, cached by TanStack Query. Keys are shared, so
// the home sections and the selection read the same requests.

/** The latest 200 likes: enough for the home list and for the selection to shuffle. */
export function useLikes() {
  return useQuery({ queryKey: ["library", "likes"], queryFn: () => myLikes({ limit: 200 }) });
}

export function useHistory() {
  return useQuery({ queryKey: ["library", "history"], queryFn: () => playHistory({ limit: 50 }) });
}

export function usePlaylists() {
  return useQuery({
    queryKey: ["library", "playlists"],
    queryFn: () => myPlaylists({ limit: 24 }),
  });
}

// The whole library, every page of it: what the Library tab shows, filters and shuffles.

const same = <T>(item: T): T => item;
const likedPlaylist = (item: LikedPlaylist) => item.playlist;
const repostedItem = (item: Repost) => item.item;

/** Every like, latest first. Loads in the background from the moment the app opens. */
export function useAllLikes() {
  return useWholeList(["library", "likes", "all"], myLikes, same);
}

export function useAllPlaylists() {
  return useWholeList(["library", "playlists", "all"], myPlaylists, same);
}

export function useAllAlbums(enabled = true) {
  return useWholeList(["library", "albums", "all"], myAlbums, same, { enabled });
}

/** Liked playlists and albums together; `isAlbum` tells them apart. */
export function useAllLikedPlaylists() {
  return useWholeList(["library", "liked-playlists", "all"], myLikedPlaylists, likedPlaylist);
}

export function useAllReposts(enabled = true) {
  return useWholeList(["library", "reposts", "all"], myReposts, repostedItem, { enabled });
}

export function useAllFollowings(enabled = true) {
  return useWholeList(["library", "followings", "all"], myFollowings, same, { enabled });
}

/** The last thousand plays, each track once, at its latest play. */
export function useRecentPlays(enabled = true) {
  const list = useWholeList(["library", "history", "all"], playHistory, same<PlayedTrack>, {
    enabled,
    maxPages: 5,
  });
  const items = useMemo(() => {
    const seen = new Set<number>();
    return list.items.filter((play) => {
      if (seen.has(play.track.id)) return false;
      seen.add(play.track.id);
      return true;
    });
  }, [list.items]);
  return { ...list, items };
}

/** One playlist or album with every track. */
export function usePlaylist(id: number) {
  return useQuery({ queryKey: ["playlist", id], queryFn: () => playlist(id) });
}

/** An artist's fifty most played tracks. */
export function useTopTracks(userId: number) {
  return useQuery({
    queryKey: ["artist", userId, "top"],
    queryFn: () => artistTopTracks(userId, { limit: 50 }),
  });
}
