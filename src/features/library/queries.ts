import { useQuery } from "@tanstack/react-query";
import { myLikes, myPlaylists, playHistory } from "@/api/library";

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
