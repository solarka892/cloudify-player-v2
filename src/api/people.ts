import { call } from "@/api/invoke";
import type { Page, PageRequest, Track } from "@/api/types";

/** An artist's most played tracks, most played first. */
export function artistTopTracks(userId: number, page?: PageRequest): Promise<Page<Track>> {
  return call<Page<Track>>("artist_top_tracks", { userId, page: page ?? null });
}
