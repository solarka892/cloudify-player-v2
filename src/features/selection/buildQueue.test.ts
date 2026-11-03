import { describe, expect, it } from "vitest";
import type { Track } from "@/api/types";
import { buildQueue, MIN_MOOD_TRACKS, type SelectionInput } from "@/features/selection/buildQueue";

function track(
  id: number,
  extra: { artist?: number; genre?: string; blocked?: boolean } = {},
): Track {
  return {
    id,
    urn: `soundcloud:tracks:${id}`,
    title: `t${id}`,
    permalinkUrl: null,
    artworkUrl: null,
    durationMs: 200_000,
    fullDurationMs: 200_000,
    user: extra.artist
      ? {
          id: extra.artist,
          urn: `soundcloud:users:${extra.artist}`,
          username: `a${extra.artist}`,
          fullName: null,
          permalinkUrl: null,
          avatarUrl: null,
          bannerUrl: null,
          description: null,
          city: null,
          countryCode: null,
          followersCount: null,
          followingsCount: null,
          trackCount: null,
          playlistCount: null,
          likesCount: null,
          verified: false,
        }
      : null,
    genre: extra.genre ?? null,
    tags: [],
    description: null,
    createdAt: null,
    playbackCount: null,
    likesCount: null,
    repostsCount: null,
    commentCount: null,
    waveformUrl: null,
    access: {
      policy: extra.blocked ? "block" : "allow",
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

const range = (from: number, to: number, extra?: Parameters<typeof track>[1]) =>
  Array.from({ length: to - from + 1 }, (_, i) => track(from + i, extra));

function input(patch: Partial<SelectionInput>): SelectionInput {
  return {
    likes: range(1, 20, { artist: 1 }),
    history: [],
    station: range(101, 110, { artist: 2 }),
    skipped: new Set(),
    mood: "usual",
    seed: 7,
    ...patch,
  };
}

const ids = (tracks: Track[]) => tracks.map((t) => t.id);

describe("buildQueue", () => {
  it("is stable for a seed and different for another", () => {
    expect(ids(buildQueue(input({})))).toEqual(ids(buildQueue(input({}))));
    expect(ids(buildQueue(input({})))).not.toEqual(ids(buildQueue(input({ seed: 8 }))));
  });

  it("mixes two likes with one track from the radio", () => {
    const queue = buildQueue(input({}));
    expect(queue).toHaveLength(30);
    expect(queue.slice(0, 9).map((t) => (t.id > 100 ? "radio" : "like"))).toEqual([
      "like",
      "like",
      "radio",
      "like",
      "like",
      "radio",
      "like",
      "like",
      "radio",
    ]);
  });

  it("never offers what was skipped, blocked, or already queued", () => {
    const queue = buildQueue(
      input({
        likes: [...range(1, 10), track(11, { blocked: true })],
        skipped: new Set([3, 104]),
        exclude: new Set([5]),
      }),
    );
    expect(ids(queue)).not.toContain(3);
    expect(ids(queue)).not.toContain(104);
    expect(ids(queue)).not.toContain(5);
    expect(ids(queue)).not.toContain(11);
  });

  it("puts recently played likes at the back", () => {
    const queue = buildQueue(input({ history: [track(1), track(2)] }));
    const likes = ids(queue).filter((id) => id < 100);
    expect(likes.slice(-2).sort()).toEqual([1, 2]);
  });

  it("keeps «любимое» to likes and «незнакомое» to the radio's strangers", () => {
    expect(buildQueue(input({ mood: "fav" })).every((t) => t.id <= 20)).toBe(true);
    const strangers = buildQueue(
      input({
        mood: "new",
        station: [...range(101, 106, { artist: 2 }), track(107, { artist: 1 })],
      }),
    );
    expect(ids(strangers)).not.toContain(107);
    expect(strangers.every((t) => t.id > 100)).toBe(true);
  });

  it("finds «бодрее» by genre and admits when there is nothing", () => {
    const up = buildQueue(
      input({ likes: [...range(1, 4, { genre: "Phonk" }), ...range(5, 8, { genre: "Ambient" })] }),
    );
    expect(up.length).toBeGreaterThan(0);
    const upbeat = buildQueue(
      input({
        mood: "up",
        likes: [...range(1, 6, { genre: "Drum & Bass" }), ...range(7, 9, { genre: "Ambient" })],
      }),
    );
    expect(upbeat.every((t) => t.id <= 6 || t.id > 100)).toBe(true);
    expect(upbeat.length).toBeGreaterThanOrEqual(MIN_MOOD_TRACKS);
    expect(buildQueue(input({ mood: "calm" }))).toEqual([]);
  });
});
