import type { Track } from "@/api/types";

/** Why a track won't play in full, said before anyone presses play. */
export function stateBadge(track: Track): string | null {
  if (track.access.policy === "block") return "не в твоём регионе";
  if (!track.access.playable) return "не играет здесь";
  if (track.access.preview) return "Go+ · 30 с";
  return null;
}
