import { describe, expect, it } from "vitest";
import { fold, makeFilter, queryWords } from "@/features/library/filter";

describe("fold", () => {
  it("ignores case, ё and accents", () => {
    expect(fold("Ёлка")).toBe(fold("елка"));
    expect(fold("Beyoncé")).toBe("beyonce");
    expect(fold("МОЙ")).toBe(fold("мой"));
  });

  it("reads punctuation as spaces", () => {
    expect(fold("Баста - Вязки (ПРЕМЬЕРА) [HQ]")).toBe("баста вязки премьера hq");
    expect(fold("  a—b  ")).toBe("a b");
  });
});

describe("makeFilter", () => {
  const tracks = [
    { title: "Я приду к тебе с клубникой в декабре", artist: "pyrokinesis" },
    { title: "Кинолента", artist: "Баста" },
    { title: "Weird Fishes / Arpeggi", artist: "Radiohead" },
  ];
  const filter = makeFilter(tracks, (t) => `${t.title} ${t.artist}`);

  it("keeps everything for an empty query", () => {
    expect(filter("")).toHaveLength(3);
    expect(filter("   ")).toHaveLength(3);
    expect(queryWords(" ")).toEqual([]);
  });

  it("matches every word, in any order, across title and artist", () => {
    expect(filter("клубник").map((t) => t.artist)).toEqual(["pyrokinesis"]);
    expect(filter("radiohead fish").map((t) => t.title)).toEqual(["Weird Fishes / Arpeggi"]);
    expect(filter("баста кино")).toHaveLength(1);
    expect(filter("баста радио")).toHaveLength(0);
  });
});
