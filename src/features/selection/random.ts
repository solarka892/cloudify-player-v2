// Chance the selection can repeat: the same seed always gives the same order,
// so a test can pin it and a queue rebuilt after a «больше такого» moves only
// what the press changed.

/** A small fast generator (mulberry32): numbers in [0, 1), the same ones for the same seed. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A track's own place in [0, 1) for this seed: it does not depend on what else
 * is in the list, so taking tracks out or adding new ones leaves the others in
 * the same order.
 */
export function placeOf(seed: number, id: number): number {
  let h = (seed ^ Math.imul(id >>> 0, 0x9e3779b1)) >>> 0;
  h = (h ^ Math.imul(Math.floor(id / 4294967296), 0x85ebca77)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The seed after this one: each refill of an endless queue gets its own order. */
export function nextSeed(seed: number): number {
  return (seed * 1_103_515_245 + 12_345) >>> 0;
}
