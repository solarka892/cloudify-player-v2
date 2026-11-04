import { describe, expect, it } from "vitest";
import { shuffled } from "@/features/library/shuffle";

describe("shuffled", () => {
  const items = Array.from({ length: 1312 }, (_, i) => i);

  it("keeps every item exactly once", () => {
    const out = shuffled(items);
    expect(out).toHaveLength(items.length);
    expect([...out].sort((a, b) => a - b)).toEqual(items);
  });

  it("does not touch the original list", () => {
    const copy = [...items];
    shuffled(items);
    expect(items).toEqual(copy);
  });

  it("reaches the oldest items, not only the latest ones", () => {
    // Where SoundCloud's shuffle only ever plays the last few loaded likes,
    // the first twenty here come from all over the list.
    const first = shuffled(items).slice(0, 20);
    expect(first.some((i) => i >= 200)).toBe(true);
  });

  it("is deterministic for a given random source", () => {
    let seed = 1;
    const random = () => {
      seed = (seed * 16_807) % 2_147_483_647;
      return (seed - 1) / 2_147_483_646;
    };
    const a = shuffled(items, random);
    seed = 1;
    expect(shuffled(items, random)).toEqual(a);
  });
});
