import { describe, expect, it } from "vitest";
import type { Play, PlaySetting } from "@/api/types";
import {
  clockOf,
  dayDate,
  dayOf,
  daysUpTo,
  dayWord,
  endingOf,
  groupDays,
  lightLength,
  minuteClock,
  partName,
  partOf,
  partTitle,
  skyOf,
  sourceWords,
} from "@/features/diary/days";

const MOSCOW = 180;
const setting = (sun: number | null = -20): PlaySetting => ({
  tod: null,
  dow: null,
  season: null,
  daylight: 9,
  sun,
  rise: 462,
  set: 1004,
  lat: 55.8,
  place: "zone",
  weather: null,
  activity: null,
  mood: null,
});

let nextId = 1;
/** A play at `time` («2026-11-04T03:40») on the Moscow clock. */
function play(time: string, patch: Partial<Play> = {}): Play {
  const startedAt = Date.parse(`${time}:00Z`) - MOSCOW * 60_000;
  return {
    id: nextId++,
    track: { id: 1, title: "t" } as Play["track"],
    startedAt,
    utcOffset: MOSCOW,
    endedAt: startedAt + 200_000,
    outcome: "finished",
    fromMs: 0,
    positionMs: 200_000,
    listenedMs: 200_000,
    durationMs: 200_000,
    liked: false,
    source: { kind: "likes", title: null, id: null },
    added: false,
    setting: setting(),
    ...patch,
  };
}

describe("days of the diary", () => {
  it("places a play by the clock it was played on", () => {
    // 23:30 in Moscow is still the 4th, though UTC has it at 20:30.
    const late = play("2026-11-04T23:30");
    expect([dayOf(late), clockOf(late), partOf(late)]).toEqual(["2026-11-04", "23:30", "evening"]);
    const night = play("2026-11-05T00:20");
    expect([dayOf(night), partOf(night)]).toEqual(["2026-11-05", "night"]);
    // The same moment played in Novosibirsk is already the 5th, at night.
    const away = { ...late, utcOffset: 420 };
    expect([dayOf(away), clockOf(away), partOf(away)]).toEqual(["2026-11-05", "03:30", "night"]);
  });

  it("names days and parts the way people say them", () => {
    const today = "2026-11-04";
    expect(dayWord("2026-11-04", today)).toBe("Сегодня");
    expect(dayWord("2026-11-03", today)).toBe("Вчера");
    expect(dayWord("2026-11-02", today)).toBe("Понедельник");
    expect(dayDate("2026-11-02", today)).toBe("2 ноября");
    expect(dayDate("2025-12-31", today)).toBe("31 декабря 2025");
    expect(dayWord("2026-01-01", "2026-01-01")).toBe("Сегодня");
    expect(dayWord("2025-12-31", "2026-01-01")).toBe("Вчера");
    expect(partName("night", "2026-10-14")).toBe("Ночь на 14-е");
    expect(partName("evening", "2026-10-14")).toBe("Вечер");
    expect(partTitle("night", "2026-10-14", today)).toBe("ночь на 14-е");
    expect(partTitle("evening", "2026-11-03", today)).toBe("вечер 3 ноября");
  });

  it("lists the days up to today for the strip, across a month", () => {
    expect(daysUpTo("2026-11-02", 4)).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("groups newest first: days, then evening before night, then plays", () => {
    const plays = [
      play("2026-11-04T03:40", { outcome: null, endedAt: null, listenedMs: 31_000 }),
      play("2026-11-04T00:22", { outcome: "skipped", positionMs: 12_000, listenedMs: 12_000 }),
      play("2026-11-03T21:26", { setting: setting(-30) }),
      play("2026-11-03T19:58", { setting: setting(-8) }),
      play("2026-11-03T16:40", { setting: setting(-2) }),
      play("2026-11-03T07:10", { setting: setting(null) }),
    ];
    const days = groupDays(plays);
    expect(days.map((d) => d.key)).toEqual(["2026-11-04", "2026-11-03"]);
    expect(days[0]?.parts.map((p) => p.name)).toEqual(["Ночь на 4-е"]);
    expect(days[1]?.parts.map((p) => p.part)).toEqual(["evening", "day", "morning"]);
    const night = days[0]?.parts[0];
    expect(night?.span).toBe("00:22–03:40");
    expect([night?.plays.length, night?.finished, night?.heardMs]).toEqual([2, 0, 43_000]);
    expect(days[1]?.parts.map((p) => p.sky)).toEqual(["dark", "dusk", null]);
    // Plays inside one minute are one clock, not «07:10–07:10».
    const short = groupDays([play("2026-11-03T07:10", { endedAt: null, listenedMs: 20_000 })]);
    expect(short[0]?.parts[0]?.span).toBe("07:10");
    expect([days[1]?.count, days[1]?.rise, days[1]?.set]).toEqual([4, 462, 1004]);
  });

  it("says how light the day was", () => {
    expect([minuteClock(462), minuteClock(1004), lightLength(462, 1004)]).toEqual([
      "7:42",
      "16:44",
      "9 ч 02 мин",
    ]);
    expect([skyOf(12), skyOf(-3), skyOf(-6), skyOf(-40), skyOf(null)]).toEqual([
      "light",
      "dusk",
      "dark",
      "dark",
      null,
    ]);
  });
});

describe("how a play ended", () => {
  it("says it in words, with how far it got", () => {
    const at = (patch: Partial<Play>) => endingOf(play("2026-11-04T03:40", patch));
    expect(at({ outcome: "finished" })).toEqual({
      tone: "done",
      text: "дослушал",
      share: 1,
      again: false,
    });
    expect(at({ outcome: "again" }).again).toBe(true);
    expect(at({ outcome: "skipped", positionMs: 12_000 })).toMatchObject({
      tone: "left",
      text: "пропустил на 0:12",
      share: 0.06,
    });
    expect(at({ outcome: "rejected", positionMs: 5_000 }).text).toBe("«не то» на 0:05");
    expect(at({ outcome: "stopped", positionMs: 150_000 }).text).toBe("остановил на 2:30");
    const open = play("2026-11-04T03:40", { outcome: null, positionMs: 30_000 });
    // An open play the player is not on reads as stopped where it was last heard.
    expect(endingOf(open).text).toBe("остановил на 0:30");
    expect(endingOf(open, { position: 31, playing: true }).text).toBe("играет · 0:31");
    // The one sounding now reads its place from the player.
    expect(endingOf(open, { position: 47, playing: false })).toMatchObject({
      tone: "live",
      text: "на паузе · 0:47",
    });
  });

  it("names where it came from", () => {
    expect(sourceWords({ kind: "likes", title: null, id: null })).toBe("из лайков");
    expect(sourceWords({ kind: "playlist", title: "ночь на 14-е", id: 1 })).toBe("«ночь на 14-е»");
    expect(sourceWords({ kind: "search", title: "deep house", id: null })).toBe(
      "поиск «deep house»",
    );
    expect(sourceWords({ kind: "diary", title: "вечер 3 ноября", id: null })).toBe(
      "из дневника · вечер 3 ноября",
    );
    expect(sourceWords({ kind: "other", title: null, id: null })).toBe("");
  });
});
