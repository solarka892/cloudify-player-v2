import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StartPlay } from "@/api/diary";
import type { Heard, PlayOutcome, Track } from "@/api/types";
import { diaryWritten, noteLiked, outcomeOf, startDiaryRecorder } from "@/features/diary/record";
import { usePlayer } from "@/features/player/store";

// The player is driven the way the audio engine drives it (positions reported
// a quarter-second apart), and the diary's commands are stood in for: what
// they were told, in order, is the test's answer.

const told = vi.hoisted(() => ({ calls: [] as unknown[][], nextId: 1 }));

vi.mock("@/api/diary", () => ({
  diaryStart: async (play: StartPlay) => {
    const id = told.nextId++;
    told.calls.push(["start", id, play.track.id, play.source.kind, play.fromMs, play.added]);
    return id;
  },
  diaryProgress: async (id: number, heard: Heard) => {
    told.calls.push(["progress", id, heard.positionMs, heard.listenedMs]);
  },
  diaryEnd: async (id: number, outcome: PlayOutcome, heard: Heard) => {
    told.calls.push(["end", id, outcome, heard.positionMs, heard.listenedMs]);
  },
  diaryLiked: async (id: number, liked: boolean) => {
    told.calls.push(["liked", id, liked]);
  },
}));

function track(id: number, seconds = 200): Track {
  return {
    id,
    urn: `soundcloud:tracks:${id}`,
    title: `t${id}`,
    permalinkUrl: null,
    artworkUrl: null,
    durationMs: seconds * 1000,
    fullDurationMs: seconds * 1000,
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

const player = () => usePlayer.getState();
let now = 0;
let stop: () => void = () => {};

/** The engine playing from where the player is up to `to` seconds, as `timeupdate` reports it. */
function hear(to: number) {
  let at = player().position;
  while (at < to - 1e-9) {
    at = Math.min(to, at + 0.25);
    now += 250;
    player().report({ position: at });
  }
}

/** What the diary was told, once it is all written; progress only when asked for. */
async function calls(progress = false) {
  await diaryWritten();
  return told.calls.filter((call) => progress || call[0] !== "progress");
}

beforeEach(() => {
  told.calls = [];
  told.nextId = 1;
  now = 1_000_000;
  usePlayer.setState({ repeat: "off" });
  stop = startDiaryRecorder(() => now);
});

afterEach(() => {
  stop();
  player().stop();
});

describe("the diary's pen", () => {
  it("writes a play from its first sound, and a skip where it was left", async () => {
    player().playQueue([track(1), track(2)], 0, { kind: "likes" });
    expect(await calls()).toEqual([]);
    hear(12);
    player().next("skip");
    expect(await calls()).toEqual([
      ["start", 1, 1, "likes", 0, false],
      ["end", 1, "skipped", 12_000, 12_000],
    ]);
  });

  it("writes a track played to the end as finished, and the next one as its own play", async () => {
    player().playQueue([track(1, 30), track(2)], 0, { kind: "playlist", title: "ночь", id: 7 });
    hear(30);
    player().next("ended");
    hear(1);
    expect(await calls()).toEqual([
      ["start", 1, 1, "playlist", 0, false],
      ["end", 1, "finished", 30_000, 30_000],
      ["start", 2, 2, "playlist", 0, false],
    ]);
  });

  it("does not write a track that never sounded", async () => {
    player().playQueue([track(1), track(2)], 0, { kind: "likes" });
    player().next("unavailable");
    expect(await calls()).toEqual([]);
  });

  it("counts only the sound heard, not the part seeked over", async () => {
    player().playQueue([track(1)], 0, { kind: "likes" });
    hear(10);
    player().seek(150);
    hear(160);
    player().stop();
    expect(await calls()).toEqual([
      ["start", 1, 1, "likes", 0, false],
      ["end", 1, "stopped", 160_000, 20_000],
    ]);
  });

  it("writes «не то» as rejected", async () => {
    player().playQueue([track(1), track(2)], 0, { kind: "selection" });
    hear(9);
    player().next("dislike");
    expect((await calls()).at(-1)).toEqual(["end", 1, "rejected", 9_000, 9_000]);
  });

  it("writes a track on repeat as played again, each round its own play", async () => {
    usePlayer.setState({ repeat: "one" });
    player().playQueue([track(1, 20), track(2)], 0, { kind: "likes" });
    hear(20);
    player().next("ended");
    hear(2);
    expect(await calls()).toEqual([
      ["start", 1, 1, "likes", 0, false],
      ["end", 1, "again", 20_000, 20_000],
      ["start", 2, 1, "likes", 0, false],
    ]);
  });

  it("writes a track sent back to its start as played again", async () => {
    player().playQueue([track(1), track(2)], 0, { kind: "likes" });
    hear(30);
    player().previous();
    hear(3);
    expect(await calls()).toEqual([
      ["start", 1, 1, "likes", 0, false],
      ["end", 1, "again", 30_000, 30_000],
      ["start", 2, 1, "likes", 0, false],
    ]);
  });

  it("writes going back to the previous track as a skip of this one", async () => {
    player().playQueue([track(1), track(2)], 1, { kind: "likes" });
    hear(2);
    player().previous();
    expect((await calls()).at(-1)).toEqual(["end", 1, "skipped", 2_000, 2_000]);
  });

  it("writes a new queue as a skip of what was playing", async () => {
    player().playQueue([track(1)], 0, { kind: "likes" });
    hear(40);
    player().playQueue([track(5)], 0, { kind: "search", title: "molchat" });
    hear(1);
    expect(await calls()).toEqual([
      ["start", 1, 1, "likes", 0, false],
      ["end", 1, "skipped", 40_000, 40_000],
      ["start", 2, 5, "search", 0, false],
    ]);
  });

  it("writes a resumed track from where it picked up", async () => {
    player().playQueue([track(1)], 0, { kind: "resume" }, { startAt: 120 });
    hear(125);
    expect((await calls())[0]).toEqual(["start", 1, 1, "resume", 120_000, false]);
  });

  it("marks a track put next by hand", async () => {
    player().playQueue([track(1), track(2)], 0, { kind: "likes" });
    player().playNext(track(9), { kind: "likes" });
    hear(1);
    player().next("skip");
    hear(1);
    expect((await calls()).at(-1)).toEqual(["start", 2, 9, "likes", 0, true]);
  });

  it("keeps a like made while the track plays, even before its sound", async () => {
    player().playQueue([track(1), track(2)], 0, { kind: "likes" });
    noteLiked(1, true);
    hear(5);
    noteLiked(2, true);
    noteLiked(1, false);
    noteLiked(1, true);
    expect(await calls()).toEqual([
      ["start", 1, 1, "likes", 0, false],
      ["liked", 1, true],
      ["liked", 1, false],
      ["liked", 1, true],
    ]);
  });

  it("writes how far it got every fifteen seconds and on pause", async () => {
    player().playQueue([track(1)], 0, { kind: "likes" });
    hear(31);
    player().setPlaying(false);
    const progress = (await calls(true)).filter((call) => call[0] === "progress");
    expect(progress).toEqual([
      ["progress", 1, 15_250, 15_250],
      ["progress", 1, 30_250, 30_250],
      ["progress", 1, 31_000, 31_000],
    ]);
  });

  it("names every way of leaving a track", () => {
    expect(
      (["ended", "again", "dislike", "skip", "replaced", "unavailable", "stopped"] as const).map(
        outcomeOf,
      ),
    ).toEqual(["finished", "again", "rejected", "skipped", "skipped", "stopped", "stopped"]);
  });
});
