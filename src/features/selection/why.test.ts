import { describe, expect, it } from "vitest";
import type { Track } from "@/api/types";
import type { Fact } from "@/features/selection/engine";
import { when, whyLine, whyParts } from "@/features/selection/why";

// Local clock times, so the words do not depend on the machine's time zone.
// Figures are held together with no-break spaces; `nb` writes them readably here.
const nb = (text: string) => text.replace(/~/g, "\u00a0");
const NOW = new Date(2026, 10, 4, 16, 30).getTime(); // Wednesday 4 November 2026, 16:30
const at = (month: number, day: number, hour: number, year = 2026) =>
  new Date(year, month, day, hour).getTime();

const titled = (title: string) => ({ id: 1, title }) as Track;

describe("when", () => {
  it("says it as a person would", () => {
    expect(when(at(10, 4, 8), NOW)).toBe("сегодня утром");
    expect(when(at(10, 4, 2), NOW)).toBe("сегодня ночью");
    expect(when(at(10, 3, 21), NOW)).toBe("вчера вечером");
    expect(when(at(10, 2, 13), NOW)).toBe("позавчера");
    expect(when(at(9, 31, 13), NOW)).toBe("в субботу");
    expect(when(at(9, 29, 13), NOW)).toBe("в четверг");
    expect(when(at(10, 3, 13), at(10, 8, 12))).toBe("во вторник");
    expect(when(at(9, 28, 13), NOW)).toBe("28 октября");
    expect(when(at(9, 12, 13), NOW)).toBe("12 октября");
    expect(when(at(11, 30, 13, 2025), NOW)).toBe("30 декабря 2025");
  });
});

describe("the «почему» line", () => {
  it("names what the radio grew from and when you heard it out", () => {
    const facts: Fact[] = [
      {
        kind: "station",
        seed: { track: titled("Цветами радуги"), reason: "finished", at: at(10, 3, 22) },
      },
      { kind: "stranger" },
    ];
    expect(whyLine(facts, NOW)).toBe(
      "Похож на «Цветами радуги» — ты дослушал его вчера вечером · новый для тебя артист",
    );
  });

  it("puts your own track's story before its artist's", () => {
    const facts: Fact[] = [
      { kind: "liked" },
      { kind: "artist", name: "pyrokinesis", finished: 12, plays: 14 },
      { kind: "finished", times: 5, of: 6 },
    ];
    // Where it came from says little here, so what you did goes first: a narrow line keeps it.
    expect(whyParts(facts, NOW)).toEqual([nb("Дослушал 5~из~6"), "из твоих лайков"]);
    expect(whyLine([{ kind: "liked" }, { kind: "finished", times: 3, of: 3 }], NOW)).toBe(
      nb("Дослушал все~3 · из твоих лайков"),
    );
    expect(
      whyLine(
        [{ kind: "liked" }, { kind: "artist", name: "pyrokinesis", finished: 12, plays: 14 }],
        NOW,
      ),
    ).toBe(nb("pyrokinesis: дослушиваешь 12~из~14 · из твоих лайков"));
  });

  it("says a favourite has been missed, and since when", () => {
    const facts: Fact[] = [
      { kind: "liked" },
      { kind: "finished", times: 4, of: 4 },
      { kind: "missed", at: at(7, 20, 12) },
    ];
    expect(whyLine(facts, NOW)).toBe("Давно не слышал — последний раз в августе · из твоих лайков");
  });

  it("reads the diary's windows and a press of «больше такого»", () => {
    expect(whyLine([{ kind: "winter", times: 4 }], NOW)).toBe(
      nb("Прошлой зимой ты слушал его 4~раза"),
    );
    expect(whyLine([{ kind: "yearAgo", times: 1 }], NOW)).toBe(
      "Эту неделю год назад ты слушал то же",
    );
    expect(
      whyLine([{ kind: "more", track: titled("Альма-матер") }, { kind: "stranger" }], NOW),
    ).toBe("Ты просил больше такого, как «Альма-матер» · новый для тебя артист");
  });

  it("is honest before it has learned anything", () => {
    expect(whyLine([{ kind: "liked" }, { kind: "rules" }], NOW)).toBe(
      "Из твоих лайков · пока по правилам — тебя ещё не выучил",
    );
    const played = {
      kind: "station" as const,
      seed: { track: titled("Положение"), reason: "played" as const, at: null },
    };
    expect(whyLine([played, { kind: "rules" }], NOW)).toBe(
      "Со станции по «Положение» — его ты включал последним · пока по правилам — тебя ещё не выучил",
    );
    expect(whyLine([], NOW)).toBe("");
  });

  it("does not say twice that a track was heard out", () => {
    const facts: Fact[] = [
      {
        kind: "related",
        seed: { track: titled("Кинолента"), reason: "finished", at: at(10, 4, 9) },
      },
      { kind: "finished", times: 1, of: 1 },
    ];
    expect(whyLine(facts, NOW)).toBe("Похож на «Кинолента» — ты дослушал его сегодня утром");
  });
});
