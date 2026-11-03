import { describe, expect, it } from "vitest";
import type { User } from "@/api/types";
import { bestArtist } from "@/features/search/best";
import { cleanFilters, genreName, hasFilters } from "@/features/search/filters";
import { remember } from "@/features/search/recent";

function user(username: string, extra: Partial<User> = {}): User {
  return {
    id: username.length,
    urn: `soundcloud:users:${username.length}`,
    username,
    fullName: null,
    permalinkUrl: null,
    avatarUrl: null,
    bannerUrl: null,
    description: null,
    city: null,
    countryCode: null,
    followersCount: 0,
    followingsCount: null,
    trackCount: null,
    playlistCount: null,
    likesCount: null,
    verified: false,
    ...extra,
  };
}

describe("bestArtist", () => {
  it("is the near-top person whose name is the query", () => {
    const artist = user("pyrokinesis", { verified: true, followersCount: 34_842 });
    expect(bestArtist([artist, user("Pyrokinesis")], "  PyroKinesis ")).toBe(artist);
    // Case, «ё» and punctuation aside, like the library's filter.
    const molchat = user("Molchat Doma", { followersCount: 58_444 });
    expect(bestArtist([molchat], "molchat-doma")).toBe(molchat);
  });

  it("matches the full name too", () => {
    const artist = user("skryptonite", { fullName: "Скриптонит", verified: true });
    expect(bestArtist([artist], "скриптонит")).toBe(artist);
  });

  it("guesses from the start of a name while typing", () => {
    const artist = user("pyrokinesis", { verified: true });
    expect(bestArtist([artist], "pyro")).toBeNull();
    expect(bestArtist([artist], "pyro", { prefix: true })).toBe(artist);
    expect(bestArtist([artist], "py", { prefix: true })).toBeNull();
  });

  it("skips namesakes and anyone ranked too low", () => {
    expect(bestArtist([user("pyrokinesis", { followersCount: 11 })], "pyrokinesis")).toBeNull();
    const far = [user("a"), user("b"), user("c"), user("pyrokinesis", { verified: true })];
    expect(bestArtist(far, "pyrokinesis")).toBeNull();
    expect(bestArtist([user("x", { verified: true })], "deep house")).toBeNull();
    expect(bestArtist([user("x", { verified: true })], "   ")).toBeNull();
  });
});

describe("remember", () => {
  it("puts the newest first without an older copy", () => {
    expect(remember(["molchat doma", "Pyrokinesis"], "  pyrokinesis  ")).toEqual([
      "pyrokinesis",
      "molchat doma",
    ]);
  });

  it("keeps at most eight and ignores blanks", () => {
    const many = Array.from({ length: 8 }, (_, i) => `q${i}`);
    expect(remember(many, "new")).toHaveLength(8);
    expect(remember(many, "new")[0]).toBe("new");
    expect(remember(["a"], "   ")).toEqual(["a"]);
  });
});

describe("filters", () => {
  it("leave nothing unset in", () => {
    expect(cleanFilters({ genre: "  Deep House ", duration: null, goPlusOnly: false })).toEqual({
      genre: "deep house",
    });
    expect(hasFilters({ genre: " ", license: null })).toBe(false);
    expect(hasFilters({ goPlusOnly: true })).toBe(true);
  });

  it("name genres with a capital", () => {
    expect(genreName("hip-hop & rap")).toBe("Hip-hop & rap");
  });
});
