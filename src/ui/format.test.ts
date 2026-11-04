import { describe, expect, it } from "vitest";
import { artworkUrl } from "@/ui/artworkUrl";
import {
  formatCount,
  formatLength,
  formatSeconds,
  plural,
  relativeDay,
  shortDate,
} from "@/ui/format";

describe("format", () => {
  it("writes lengths like a player", () => {
    expect(formatSeconds(0)).toBe("0:00");
    expect(formatSeconds(246.9)).toBe("4:06");
    expect(formatSeconds(3753)).toBe("1:02:33");
    expect(formatSeconds(Number.NaN)).toBe("0:00");
  });

  it("groups thousands the Russian way", () => {
    expect(formatCount(1312).replace(/\s/g, " ")).toBe("1 312");
  });

  it("picks the Russian plural", () => {
    const forms = ["трек", "трека", "треков"] as const;
    expect([1, 2, 5, 11, 21, 24, 38, 64, 112].map((n) => plural(n, forms))).toEqual([
      "трек",
      "трека",
      "треков",
      "треков",
      "трек",
      "трека",
      "треков",
      "трека",
      "треков",
    ]);
  });

  it("says when, the way people do", () => {
    const now = new Date(2026, 10, 3, 18, 0);
    expect(relativeDay(new Date(2026, 10, 3, 9, 0).toISOString(), now)).toBe("сегодня");
    expect(relativeDay(new Date(2026, 10, 2, 23, 0).toISOString(), now)).toBe("вчера");
    expect(relativeDay(new Date(2026, 9, 31, 12, 0).toISOString(), now)).toBe("3 дня назад");
    expect(relativeDay(new Date(2026, 9, 12, 12, 0).toISOString(), now)).toBe("12 октября");
    expect(relativeDay("not a date", now)).toBe("");
  });
});

describe("artworkUrl", () => {
  it("swaps the size token", () => {
    const art = "https://i1.sndcdn.com/artworks-000067273316-smsiqx-large.jpg";
    expect(artworkUrl(art, 500)).toBe(
      "https://i1.sndcdn.com/artworks-000067273316-smsiqx-t500x500.jpg",
    );
    expect(artworkUrl("https://i1.sndcdn.com/avatars-1-t500x500.png?x=1", 100)).toBe(
      "https://i1.sndcdn.com/avatars-1-large.png?x=1",
    );
  });

  it("leaves unknown shapes alone", () => {
    for (const url of [
      "https://i1.sndcdn.com/artworks-000067273316-smsiqx.jpg",
      "https://example.com/t500x500/cover-large-ish.jpg",
      "",
    ]) {
      expect(artworkUrl(url, 300)).toBe(url);
    }
  });

  it("says how long a whole list plays", () => {
    expect(formatLength(45 * 60_000)).toBe("45 мин");
    expect(formatLength(2 * 3_600_000)).toBe("2 ч");
    expect(formatLength(87 * 3_600_000 + 12 * 60_000)).toBe("87 ч 12 мин");
  });

  it("dates a list row briefly, with the year only when it differs", () => {
    const now = new Date(2026, 10, 3, 12);
    expect(shortDate(new Date(2026, 10, 3, 9).toISOString(), now)).toBe("сегодня");
    expect(shortDate(new Date(2026, 10, 1, 9).toISOString(), now)).toBe("2 дня назад");
    expect(shortDate(new Date(2026, 9, 12, 9).toISOString(), now)).toBe("12 окт");
    expect(shortDate(new Date(2019, 4, 9, 9).toISOString(), now)).toBe("9 мая 2019");
    expect(shortDate("not a date", now)).toBe("");
  });
});
