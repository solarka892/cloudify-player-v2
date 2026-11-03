import { useEffect } from "react";
import type { Track } from "@/api/types";
import { makeFilter } from "@/features/library/filter";
import { useAllLikes } from "@/features/library/queries";
import { type QueueSource, usePlayer } from "@/features/player/store";
import { canPlay } from "@/features/selection/buildQueue";

/** What the filter reads of a track: its title and who uploaded it. */
export function trackText(track: Track): string {
  return `${track.title} ${track.user?.username ?? ""}`;
}

/**
 * Plays `tracks` in order from `start` (from the top without one), skipping
 * what cannot play here. Says so and returns `false` when nothing can.
 */
export function playInOrder(tracks: readonly Track[], source: QueueSource, start?: Track): boolean {
  const playable = tracks.filter(canPlay);
  const index = start ? playable.findIndex((track) => track.id === start.id) : 0;
  if (playable.length === 0 || index < 0) {
    usePlayer.getState().say("Здесь нечего включить: ни один трек не играет в этом приложении");
    return false;
  }
  usePlayer.getState().playQueue(playable, index, source);
  return true;
}

/**
 * Plays every playable track of `tracks` in a fresh random order, from a random
 * one. The queue remembers the list's own order: shuffle off brings it back.
 */
export function playShuffled(tracks: readonly Track[], source: QueueSource): boolean {
  const playable = tracks.filter(canPlay);
  if (playable.length === 0) {
    usePlayer.getState().say("Здесь нечего включить: ни один трек не играет в этом приложении");
    return false;
  }
  const first = Math.floor(Math.random() * playable.length);
  usePlayer.getState().playQueue(playable, first, source, { shuffle: true });
  return true;
}

/** A shuffle of the likes started before every page was in; the rest joins once it is. */
let unfinishedShuffle: { source: QueueSource; query: string } | null = null;

/**
 * Shuffles the likes that match `query` (all of them for an empty one). When
 * some pages are still on their way it starts with what is here, and the rest
 * joins the queue the moment it arrives.
 */
export function shuffleLikes(loaded: readonly Track[], query: string, complete: boolean) {
  const source: QueueSource = { kind: "likes" };
  const filter = makeFilter(loaded, trackText);
  if (playShuffled(filter(query), source) && !complete) unfinishedShuffle = { source, query };
}

/**
 * Mounted once by the shell: keeps every like loading from the moment the app
 * opens, so «Перемешать все» means all of them, and finishes an early shuffle.
 */
export function useLikesInBackground() {
  const likes = useAllLikes();
  const { complete, items } = likes;
  useEffect(() => {
    if (!complete || !unfinishedShuffle) return;
    const { source, query } = unfinishedShuffle;
    unfinishedShuffle = null;
    const player = usePlayer.getState();
    // Something else plays by now: leave it alone.
    if (player.source !== source) return;
    const all = makeFilter(
      items.map((like) => like.track),
      trackText,
    )(query);
    // Mixed into what is ahead while shuffled, in the likes' order once shuffle is off.
    player.extendSource(all.filter(canPlay));
  }, [complete, items]);
}
