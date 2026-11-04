import { describe, expect, it } from "vitest";
import type { Track } from "@/api/types";
import { sayMix, sourceRows, whatItKnows } from "@/features/selection/desk";
import { DEFAULT_SETTINGS, type SourceCount, type SourceId } from "@/features/selection/engine";
import { learn, OUTCOME, type PlayRow } from "@/features/selection/taste";
import { formatCount } from "@/ui/format";

const NOW = new Date(2026, 10, 4, 19, 30).getTime();
const DAY = 86_400_000;

describe("the balance in words", () => {
  it("says what each position plays", () => {
    expect(sayMix(0)).toBe("Только знакомое: лайки, история и дневник");
    expect(sayMix(4)).toBe("Каждый третий трек — новый");
    expect(sayMix(3)).toBe("Каждый четвёртый трек — новый");
    expect(sayMix(6)).toBe("Поровну знакомого и нового");
    expect(sayMix(8)).toBe("Каждый третий трек — знакомый, остальное новое");
    expect(sayMix(12)).toBe("Только новое: станции и похожие треки");
  });
});

const counts = (offered: Partial<Record<SourceId, number>>) =>
  Object.fromEntries(
    (["likes", "history", "winter", "yearAgo", "stations", "related"] as const).map((id) => [
      id,
      { offered: offered[id] ?? 0, picked: 0 },
    ]),
  ) as Record<SourceId, SourceCount>;

const seed = (title: string, reason: "finished" | "played") => ({
  track: { id: 1, title } as Track,
  reason,
  at: null,
});

describe("sources on the desk", () => {
  const windows = {
    winter: { from: new Date(2025, 11, 1).getTime(), to: new Date(2026, 2, 1).getTime() },
    yearAgo: { from: new Date(2025, 10, 1).getTime(), to: new Date(2025, 10, 8).getTime() },
  };

  it("says honestly why a source is empty and when it will fill", () => {
    const rows = sourceRows({
      likes: 1312,
      counts: counts({ likes: 1300, stations: 48 }),
      settings: DEFAULT_SETTINGS.sources,
      stations: [seed("Положение", "played")],
      related: [],
      plays: 0,
      since: null,
      windows,
      now: NOW,
    });
    const line = (id: SourceId) => rows.find((r) => r.id === id)?.line;
    expect(line("likes")).toBe(`${formatCount(1312)} треков · недавно игравшие — в конце`);
    expect(line("stations")).toBe("По «Положение» — его ты включал последним");
    expect(line("history")).toBe(
      "Пусто: история SoundCloud придёт, когда дневник узнает, что из неё ты дослушиваешь",
    );
    expect(line("related")).toBe("Пусто: появятся, когда дослушаешь первый трек");
    expect(line("winter")).toBe("Пусто: появится в марте 2027 — после первой зимы с дневником");
    expect(line("yearAgo")).toBe("Пусто: появится в ноябре 2027, когда дневнику будет год");
    expect(rows.filter((r) => r.empty).map((r) => r.id)).toEqual([
      "history",
      "winter",
      "yearAgo",
      "related",
    ]);
  });

  it("names what fills a source once the diary has it", () => {
    const rows = sourceRows({
      likes: 588,
      counts: counts({ history: 7, winter: 12, yearAgo: 0 }),
      settings: DEFAULT_SETTINGS.sources,
      stations: [seed("Альма-матер", "finished"), seed("Кинолента", "finished")],
      related: [seed("Альма-матер", "finished")],
      plays: 400,
      since: new Date(2025, 0, 10).getTime(),
      windows,
      now: NOW,
    });
    const line = (id: SourceId) => rows.find((r) => r.id === id)?.line;
    expect(line("history")).toBe(
      "7 треков из истории SoundCloud и дневника, которые ты дослушиваешь",
    );
    expect(line("stations")).toBe("По «Альма-матер», «Кинолента» — их ты дослушал недавно");
    expect(line("winter")).toBe("12 треков, которые ты дослушивал прошлой зимой");
    expect(line("yearAgo")).toBe("Пусто: в эту неделю год назад ты здесь ничего не дослушал");
  });
});

describe("what the selection knows", () => {
  const row = (track: number, artist: number, outcome: number, heardS = 200): PlayRow => [
    track,
    artist,
    NOW - DAY,
    outcome,
    heardS,
    heardS,
    200,
    0,
  ];

  it("names the artists you hear out and those you leave in seconds", () => {
    const rows: PlayRow[] = [
      ...Array.from({ length: 9 }, (_, i) => row(100 + i, 1, OUTCOME.finished)),
      row(110, 1, OUTCOME.skipped, 5),
      ...Array.from({ length: 3 }, (_, i) => row(200 + i, 2, OUTCOME.finished)),
      ...Array.from({ length: 3 }, (_, i) => row(300 + i, 3, OUTCOME.skipped, 4)),
      row(400, 4, OUTCOME.rejected, 6),
    ];
    const names = new Map([
      [1, "pyrokinesis"],
      [2, "Molchat Doma"],
      [3, "DJ Dyablow"],
      [4, "Electro Music"],
    ]);
    const known = whatItKnows(learn(rows, NOW), names);
    expect(known.plays).toBe(17);
    expect(known.loved.map((a) => [a.name, a.heardOut, a.plays])).toEqual([
      ["pyrokinesis", 9, 10],
      ["Molchat Doma", 3, 3],
    ]);
    expect(known.left.map((a) => [a.name, a.early, a.plays])).toEqual([["DJ Dyablow", 3, 3]]);
    expect(known.rejected).toBe(1);
    expect(whatItKnows(null, names)).toEqual({ plays: 0, loved: [], left: [], rejected: 0 });
  });
});
