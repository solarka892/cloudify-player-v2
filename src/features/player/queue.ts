import type { Track } from "@/api/types";
import { shuffled } from "@/features/library/shuffle";

// The queue's order, as plain functions over a snapshot, so every rule here is
// a test away: what a shuffle covers, where shuffle-off comes back to, what
// «Вернуть» puts back and where.

/** One place in the queue. */
export interface QueueEntry {
  /** Unique while the entry lives: rows are keyed by it, drags and «Вернуть» find it by it. */
  readonly key: number;
  readonly track: Track;
  /** Put here by the person («Играть следующим»), not by the list the queue came from. */
  readonly added: boolean;
}

export interface QueueOrder {
  readonly queue: readonly QueueEntry[];
  /** The playing entry; −1 when nothing is queued. */
  readonly index: number;
  /** The list's own order while the queue is shuffled; `null` while it plays in that order. */
  readonly original: readonly QueueEntry[] | null;
}

let lastKey = 0;

export function entry(track: Track, added = false): QueueEntry {
  lastKey += 1;
  return { key: lastKey, track, added };
}

/** A fresh queue of `tracks` from `index`. Shuffled, it starts there and mixes all the rest. */
export function startOrder(
  tracks: readonly Track[],
  index: number,
  shuffle: boolean,
  random: () => number = Math.random,
): QueueOrder {
  const list = tracks.map((track) => entry(track));
  const first = list[index];
  if (!shuffle || !first) return { queue: list, index, original: null };
  return {
    queue: [
      first,
      ...shuffled(
        list.filter((_, i) => i !== index),
        random,
      ),
    ],
    index: 0,
    original: list,
  };
}

/** Where a view splits the queue: what played, what plays, what the person added, the rest. */
export function split(order: QueueOrder) {
  const { queue, index } = order;
  const before = index > 0 ? queue.slice(0, index) : [];
  const now = queue[index] ?? null;
  const ahead = index >= 0 ? queue.slice(index + 1) : [];
  let mine = 0;
  while (mine < ahead.length && ahead[mine]?.added) mine += 1;
  return { before, now, mine: ahead.slice(0, mine), rest: ahead.slice(mine), ahead };
}

/**
 * Shuffle on: everything not heard yet goes into a fresh order — the whole
 * list, not only what came after — behind the playing track and what the
 * person added. What already played stays behind it, so «назад» still works.
 */
export function shuffleOn(
  order: QueueOrder,
  heard: ReadonlySet<number>,
  random: () => number = Math.random,
): QueueOrder {
  const now = order.queue[order.index];
  if (!now || order.original) return order;
  const others = order.queue.filter((e) => e.key !== now.key);
  const played = others.filter((e) => heard.has(e.key));
  const mine = others.filter((e) => e.added && !heard.has(e.key));
  const rest = others.filter((e) => !e.added && !heard.has(e.key));
  return {
    queue: [...played, now, ...mine, ...shuffled(rest, random)],
    index: played.length,
    original: order.queue.filter((e) => !e.added || e.key === now.key),
  };
}

/** Shuffle off: back to the list's own order, from where the playing track stands in it. */
export function shuffleOff(order: QueueOrder): QueueOrder {
  const now = order.queue[order.index];
  if (!now || !order.original) return { ...order, original: null };
  const mine = order.queue.slice(order.index + 1).filter((e) => e.added);
  const mineKeys = new Set(mine.map((e) => e.key));
  const present = new Set(order.queue.map((e) => e.key));
  const own = order.original.filter((e) => present.has(e.key) && !mineKeys.has(e.key));
  const list = own.filter((e) => e.key !== now.key);
  let at = own.findIndex((e) => e.key === now.key);
  if (at < 0) {
    // The playing track is one the person added: the list goes on after the last of its own that played.
    const last = order.queue
      .slice(0, order.index)
      .reverse()
      .find((e) => !e.added);
    at = last ? list.findIndex((e) => e.key === last.key) + 1 : 0;
  }
  const queue = [...list.slice(0, at), now, ...mine, ...list.slice(at)];
  return { queue, index: at, original: null };
}

/** Takes the upcoming entries with these keys out (and out of the list's own order). */
export function without(order: QueueOrder, keys: ReadonlySet<number>): QueueOrder {
  return {
    queue: order.queue.filter((e, i) => i <= order.index || !keys.has(e.key)),
    index: order.index,
    original: order.original?.filter((e) => !keys.has(e.key)) ?? null,
  };
}

/**
 * Puts taken-out entries back («Вернуть»): before `beforeKey` while that entry
 * is still ahead, at the end when they were last, else right after the playing
 * track. While shuffled they also return to their place in the list's own order.
 */
export function putBack(
  order: QueueOrder,
  lost: readonly QueueEntry[],
  beforeKey: number | null,
  originalThen: readonly QueueEntry[] | null,
): QueueOrder {
  const present = new Set(order.queue.map((e) => e.key));
  const missing = lost.filter((e) => !present.has(e.key));
  if (missing.length === 0 || order.index < 0) return order;
  const before = beforeKey === null ? -1 : order.queue.findIndex((e) => e.key === beforeKey);
  const at =
    before > order.index ? before : beforeKey === null ? order.queue.length : order.index + 1;
  const queue = [...order.queue.slice(0, at), ...missing, ...order.queue.slice(at)];
  if (!order.original) return { queue, index: order.index, original: null };
  const keys = new Set(queue.map((e) => e.key));
  const then = (originalThen ?? []).filter((e) => keys.has(e.key));
  const thenKeys = new Set(then.map((e) => e.key));
  const since = order.original.filter((e) => !thenKeys.has(e.key));
  const back = missing.filter((e) => !e.added && !thenKeys.has(e.key));
  return { queue, index: order.index, original: [...then, ...since, ...back] };
}

/** Moves an upcoming entry to just before `beforeKey`, or to the end with `null`. */
export function moveBefore(order: QueueOrder, key: number, beforeKey: number | null): QueueOrder {
  const from = order.queue.findIndex((e) => e.key === key);
  const moving = order.queue[from];
  if (!moving || from <= order.index || key === beforeKey) return order;
  const rest = order.queue.filter((_, i) => i !== from);
  let to = beforeKey === null ? rest.length : rest.findIndex((e) => e.key === beforeKey);
  if (to < 0) to = rest.length;
  to = Math.max(to, order.index + 1);
  return { ...order, queue: [...rest.slice(0, to), moving, ...rest.slice(to)] };
}

/** Moves an upcoming entry one place up or down; at either end of what is ahead it stays. */
export function moveBy(order: QueueOrder, key: number, step: 1 | -1): QueueOrder {
  const from = order.queue.findIndex((e) => e.key === key);
  const to = from + step;
  const moving = order.queue[from];
  const other = order.queue[to];
  if (!moving || !other || from <= order.index || to <= order.index) return order;
  const queue = [...order.queue];
  queue[from] = other;
  queue[to] = moving;
  return { ...order, queue };
}

/** Right after the playing track, marked as the person's; the same track further on goes. */
export function insertNext(order: QueueOrder, track: Track): QueueOrder {
  const now = order.queue[order.index];
  if (!now) return startOrder([track], 0, false);
  const ahead = order.queue.slice(order.index + 1).filter((e) => e.track.id !== track.id);
  return {
    queue: [...order.queue.slice(0, order.index + 1), entry(track, true), ...ahead],
    index: order.index,
    original: order.original?.filter((e) => e.track.id !== track.id || e.key === now.key) ?? null,
  };
}

/**
 * The list the queue came from has grown (the rest of the likes arrived): the
 * new tracks join it — mixed into what is ahead while shuffled, at the end
 * otherwise. Tracks already queued are not added twice.
 */
export function extend(
  order: QueueOrder,
  tracks: readonly Track[],
  random: () => number = Math.random,
): QueueOrder {
  const have = new Set(order.queue.map((e) => e.track.id));
  const fresh = tracks.filter((t) => !have.has(t.id)).map((t) => entry(t));
  if (fresh.length === 0 || order.index < 0) return order;
  if (!order.original) return { ...order, queue: [...order.queue, ...fresh] };
  const ahead = order.queue.slice(order.index + 1);
  return {
    queue: [
      ...order.queue.slice(0, order.index + 1),
      ...ahead.filter((e) => e.added),
      ...shuffled([...ahead.filter((e) => !e.added), ...fresh], random),
    ],
    index: order.index,
    original: [...order.original, ...fresh],
  };
}

/** Swaps what comes after the playing track (a mood changed); what the person added stays first. */
export function replaceAhead(order: QueueOrder, tracks: readonly Track[]): QueueOrder {
  const now = order.queue[order.index];
  if (!now) return order;
  const mine = order.queue.slice(order.index + 1).filter((e) => e.added);
  const skip = new Set([now.track.id, ...mine.map((e) => e.track.id)]);
  return {
    queue: [
      ...order.queue.slice(0, order.index + 1),
      ...mine,
      ...tracks.filter((t) => !skip.has(t.id)).map((t) => entry(t)),
    ],
    index: order.index,
    original: null,
  };
}
