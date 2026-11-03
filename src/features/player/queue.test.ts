import { describe, expect, it } from "vitest";
import type { Track } from "@/api/types";
import {
  extend,
  insertNext,
  moveBefore,
  moveBy,
  putBack,
  type QueueOrder,
  replaceAhead,
  shuffleOff,
  shuffleOn,
  split,
  startOrder,
  without,
} from "@/features/player/queue";

function track(id: number): Track {
  return {
    id,
    urn: `soundcloud:tracks:${id}`,
    title: `t${id}`,
    permalinkUrl: null,
    artworkUrl: null,
    durationMs: 200_000,
    fullDurationMs: 200_000,
    user: null,
    genre: null,
    tags: [],
    description: null,
    createdAt: null,
    playbackCount: null,
    likesCount: null,
    repostsCount: null,
    commentCount: null,
    waveformUrl: null,
    access: {
      policy: "allow",
      monetization: "not-applicable",
      goPlus: false,
      preview: false,
      playable: true,
    },
    downloadable: false,
    license: null,
    labelName: null,
    purchaseUrl: null,
    purchaseTitle: null,
    private: false,
  };
}

const list = (n: number) => Array.from({ length: n }, (_, i) => track(i + 1));
const ids = (order: QueueOrder) => order.queue.map((e) => e.track.id);
const nowId = (order: QueueOrder) => order.queue[order.index]?.track.id;
/** The queue moved on to `index`, as the player does, remembering what played. */
function playTo(order: QueueOrder, index: number, heard: Set<number>): QueueOrder {
  for (let i = order.index; i <= index; i++) {
    const e = order.queue[i];
    if (e) heard.add(e.key);
  }
  return { ...order, index };
}
function seeded(seed: number) {
  return () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return (seed - 1) / 2_147_483_646;
  };
}

describe("startOrder", () => {
  it("plays the list in its order from the chosen track", () => {
    const order = startOrder(list(5), 2, false);
    expect(ids(order)).toEqual([1, 2, 3, 4, 5]);
    expect(nowId(order)).toBe(3);
    expect(order.original).toBeNull();
  });

  it("shuffled, starts with the chosen track and mixes every other one", () => {
    const order = startOrder(list(1312), 700, true, seeded(7));
    expect(nowId(order)).toBe(701);
    expect(order.index).toBe(0);
    expect([...ids(order)].sort((a, b) => a - b)).toEqual(
      ids({ ...order, queue: order.original ?? [] }),
    );
    // Not the last few loaded: the next twenty come from all over the list.
    expect(
      ids(order)
        .slice(1, 21)
        .some((id) => id < 200),
    ).toBe(true);
  });
});

describe("shuffle on and off", () => {
  it("mixes everything not heard yet, including what came before the playing track", () => {
    const heard = new Set<number>();
    // Started from the 50th track in order, three played.
    const order = playTo(startOrder(list(100), 49, false), 52, heard);
    const mixed = shuffleOn(order, heard, seeded(3));
    expect(nowId(mixed)).toBe(53);
    expect(ids(mixed).slice(0, mixed.index)).toEqual([50, 51, 52]);
    const ahead = ids(mixed).slice(mixed.index + 1);
    expect(ahead).toHaveLength(96);
    expect(ahead).toContain(1);
    expect(ahead).toContain(100);
    expect(ahead).not.toContain(50);
  });

  it("comes back to the list's own order from where the playing track stands", () => {
    const heard = new Set<number>();
    const mixed = playTo(startOrder(list(30), 0, true, seeded(5)), 4, heard);
    const playing = nowId(mixed);
    const back = shuffleOff(mixed);
    expect(ids(back)).toEqual(ids(startOrder(list(30), 0, false)));
    expect(nowId(back)).toBe(playing);
    expect(back.original).toBeNull();
  });

  it("keeps what the person added right after the playing track, both ways", () => {
    const heard = new Set<number>();
    let order = playTo(startOrder(list(10), 0, false), 2, heard);
    order = insertNext(order, track(99));
    const mixed = shuffleOn(order, heard, seeded(11));
    expect(ids(mixed)[mixed.index + 1]).toBe(99);
    const back = shuffleOff(mixed);
    expect(ids(back)).toEqual([1, 2, 3, 99, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("does not bring back what was taken out while shuffled", () => {
    const mixed = startOrder(list(10), 0, true, seeded(2));
    const gone = mixed.queue[3];
    if (!gone) throw new Error("no fourth entry");
    const back = shuffleOff(without(mixed, new Set([gone.key])));
    expect(ids(back)).toHaveLength(9);
    expect(ids(back)).not.toContain(gone.track.id);
  });

  it("continues the list after its last heard track when an added one plays", () => {
    const heard = new Set<number>();
    let order = playTo(startOrder(list(8), 0, true, seeded(9)), 1, heard);
    const lastOwn = nowId(order);
    order = insertNext(order, track(50));
    order = playTo(order, order.index + 1, heard);
    const back = shuffleOff(order);
    const at = ids(back).indexOf(50);
    expect(nowId(back)).toBe(50);
    expect(ids(back)[at - 1]).toBe(lastOwn);
    expect(ids(back)).toHaveLength(9);
  });
});

describe("taking out and putting back", () => {
  it("puts a removed track back where it was", () => {
    const order = startOrder(list(6), 1, false);
    const gone = order.queue[3];
    if (!gone) throw new Error("no fourth entry");
    const after = without(order, new Set([gone.key]));
    expect(ids(after)).toEqual([1, 2, 3, 5, 6]);
    const back = putBack(after, [gone], order.queue[4]?.key ?? null, order.original);
    expect(ids(back)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("brings a cleared queue back after the playing track", () => {
    const order = startOrder(list(5), 1, false);
    const lost = order.queue.slice(2);
    const cleared = without(order, new Set(lost.map((e) => e.key)));
    expect(ids(cleared)).toEqual([1, 2]);
    expect(ids(putBack(cleared, lost, null, null))).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns entries to the list's own order while shuffled", () => {
    const mixed = startOrder(list(12), 0, true, seeded(4));
    const gone = mixed.queue[5];
    if (!gone) throw new Error("no sixth entry");
    const taken = without(mixed, new Set([gone.key]));
    const back = putBack(taken, [gone], mixed.queue[6]?.key ?? null, mixed.original);
    expect(ids(shuffleOff(back))).toEqual(list(12).map((t) => t.id));
  });

  it("never takes out what already played or plays", () => {
    const order = startOrder(list(4), 2, false);
    const keys = new Set(order.queue.map((e) => e.key));
    expect(ids(without(order, keys))).toEqual([1, 2, 3]);
  });
});

describe("moving", () => {
  it("moves an upcoming track before another one, or to the end", () => {
    const order = startOrder(list(6), 0, false);
    const [, two, , four] = order.queue;
    if (!two || !four) throw new Error("short queue");
    expect(ids(moveBefore(order, four.key, two.key))).toEqual([1, 4, 2, 3, 5, 6]);
    expect(ids(moveBefore(order, two.key, null))).toEqual([1, 3, 4, 5, 6, 2]);
  });

  it("never moves anything in front of the playing track", () => {
    const order = startOrder(list(5), 2, false);
    const first = order.queue[0];
    const five = order.queue[4];
    if (!first || !five) throw new Error("short queue");
    expect(ids(moveBefore(order, five.key, first.key))).toEqual([1, 2, 3, 5, 4]);
    expect(ids(moveBefore(order, first.key, null))).toEqual([1, 2, 3, 4, 5]);
  });

  it("steps one place with the keyboard and stops at the edges", () => {
    const order = startOrder(list(5), 1, false);
    const three = order.queue[2];
    if (!three) throw new Error("short queue");
    expect(ids(moveBy(order, three.key, 1))).toEqual([1, 2, 4, 3, 5]);
    expect(ids(moveBy(order, three.key, -1))).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("playing next", () => {
  it("puts the track right after the playing one and drops it further on", () => {
    const order = insertNext(startOrder(list(5), 0, false), track(4));
    expect(ids(order)).toEqual([1, 4, 2, 3, 5]);
    expect(split(order).mine.map((e) => e.track.id)).toEqual([4]);
  });

  it("starts a queue of its own when nothing plays", () => {
    const order = insertNext({ queue: [], index: -1, original: null }, track(9));
    expect(ids(order)).toEqual([9]);
    expect(order.index).toBe(0);
  });
});

describe("growing and replacing", () => {
  it("adds the rest of a list at the end, in order", () => {
    const order = extend(startOrder(list(3), 0, false), list(6));
    expect(ids(order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("mixes the rest of a list into what is ahead while shuffled", () => {
    const order = extend(startOrder(list(3), 0, true, seeded(8)), list(40), seeded(8));
    expect(ids(order)).toHaveLength(40);
    expect(new Set(ids(order)).size).toBe(40);
    expect(ids(shuffleOff(order))).toEqual(list(40).map((t) => t.id));
  });

  it("swaps what is ahead but keeps what the person added", () => {
    const order = insertNext(startOrder(list(4), 0, false), track(20));
    expect(ids(replaceAhead(order, [track(30), track(1), track(31)]))).toEqual([1, 20, 30, 31]);
  });
});
