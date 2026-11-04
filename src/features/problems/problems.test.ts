import { QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/invoke";
import { queryClient } from "@/app/queryClient";
import { isActive, useConnection, useProblems } from "@/features/problems/store";
import {
  crashWords,
  detailsOf,
  EXPIRED,
  likeWords,
  loadWords,
  partOf,
  reportOf,
} from "@/features/problems/words";

const playlists = { name: "Плейлисты", form: "pl" } as const;
const history = { name: "История", form: "f" } as const;
const playlist = { name: "Плейлист", form: "m" } as const;

describe("words", () => {
  it("agree with what broke", () => {
    const failed = new ApiError("api", "SoundCloud answered 502: …", 502);
    expect(loadWords(playlists, failed).title).toBe("Плейлисты не загрузились");
    expect(loadWords(history, failed).title).toBe("История не загрузилась");
    expect(loadWords(playlist, failed).title).toBe("Плейлист не загрузился");
    expect(loadWords(playlists, failed, true).title).toBe("Плейлисты загрузились не до конца");
    expect(crashWords(history).title).toBe("История сломалась");
  });

  it("say what happens next without a network", () => {
    const offline = new ApiError("network", "network error: dns");
    const words = loadWords(history, offline);
    expect(words.title).toBe("История не успела загрузиться");
    expect(words.text).toBe("Нет сети. Догрузится сама, как только появится интернет.");
    expect(words.short).toBe("Нет сети");
  });

  it("count down when SoundCloud asks to wait", () => {
    const words = loadWords(playlists, new ApiError("rate-limited", "slow down", 429, 20));
    expect(words.title).toBe("SoundCloud просит подождать");
    expect(words.text).toContain("Плейлисты догрузятся сами через 20 с");
  });

  it("turn a refused sign-in into one message", () => {
    expect(loadWords(playlists, new ApiError("unauthorized", "refused", 401))).toBe(EXPIRED);
  });

  it("tell the bot filter apart from other refusals of a like", () => {
    const filtered = likeWords("Альма-матер", true, new ApiError("bot-filtered", "dd", 403));
    expect(filtered.title).toBe("SoundCloud не пустил лайк");
    expect(filtered.text).toContain("сердечко у «Альма-матер» не поставилось");
    expect(filtered.short).toBe("Лайк не прошёл");
    const offline = likeWords("Альма-матер", false, new ApiError("network", "dns"));
    expect(offline.title).toBe("Лайк не снялся");
    expect(offline.text).toBe("Сердечко у «Альма-матер» осталось. Нет сети.");
  });

  it("name the part a query fills, and keep quiet about the rest", () => {
    expect(partOf(["library", "playlists", "all"])?.name).toBe("Плейлисты");
    expect(partOf(["library", "history"])?.form).toBe("f");
    expect(partOf(["search", "molchat doma", "tracks", {}])?.name).toBe("Найденные треки");
    expect(partOf(["search", "suggest", "molch"])).toBeNull();
    expect(partOf(["waveform", "https://wave"])).toBeNull();
    expect(partOf(["session"])).toBeNull();
  });

  it("say what SoundCloud answered, and to what", () => {
    const filtered = new ApiError("bot-filtered", "DataDome refused", 403);
    filtered.command = "like_track";
    const details = detailsOf(filtered);
    expect(details.answer).toBe("403 Forbidden · защита от ботов DataDome");
    expect(details.asked).toBe("Лайк (like_track)");
    expect(detailsOf(new ApiError("network", "dns")).answer).toBe("Не ответил: нет сети");
    const crash = detailsOf(new ApiError("app", "TypeError: x is null"), true, "\n at A\n at B");
    expect(crash.answer).toContain("ошибка в самом приложении");
    expect(crash.message).toBe("TypeError: x is null\nat A\nat B");
    const report = reportOf("Лайк не прошёл", Date.UTC(2026, 10, 4, 12), details);
    expect(report).toContain("Cloudify: Лайк не прошёл");
    expect(report).toContain("Что спрашивали: Лайк (like_track)");
  });
});

describe("the list of problems", () => {
  afterEach(() => useProblems.setState({ list: [], open: false, focus: null, pings: 0 }));

  const add = (id: string, kind: "load" | "action" = "load") =>
    useProblems.getState().add({
      id,
      kind,
      title: id,
      text: "",
      short: id,
      error: new ApiError("api", "502", 502),
      cause: null,
    });

  it("replaces a problem that happens again instead of listing it twice", () => {
    add("a");
    add("b");
    add("a");
    expect(useProblems.getState().list.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("keeps a solved problem a while, as solved", () => {
    add("a");
    useProblems.getState().resolve("a");
    const [solved] = useProblems.getState().list;
    expect(solved && isActive(solved)).toBe(false);
    add("a");
    expect(useProblems.getState().list.filter(isActive)).toHaveLength(1);
  });

  it("forgets old solved problems", () => {
    for (let i = 0; i < 20; i++) {
      add(`p${i}`);
      useProblems.getState().resolve(`p${i}`);
    }
    add("now");
    expect(useProblems.getState().list.length).toBeLessThanOrEqual(13);
  });

  it("catches the eye only for things that did not happen", () => {
    add("load");
    expect(useProblems.getState().pings).toBe(0);
    add("like", "action");
    expect(useProblems.getState().pings).toBe(1);
  });
});

describe("the connection", () => {
  afterEach(() =>
    useConnection.setState({ offline: false, backAt: null, expired: false, asking: false }),
  );

  it("remembers when the network came back", () => {
    useConnection.getState().found();
    expect(useConnection.getState().backAt).toBeNull();
    useConnection.getState().lost();
    useConnection.getState().found();
    expect(useConnection.getState().offline).toBe(false);
    expect(useConnection.getState().backAt).not.toBeNull();
  });

  it("asks for the sign-in once, when it expires", () => {
    useConnection.getState().expire();
    expect(useConnection.getState().asking).toBe(true);
    useConnection.getState().ask(false);
    useConnection.getState().expire();
    expect(useConnection.getState().asking).toBe(false);
    useConnection.getState().renewed();
    expect(useConnection.getState().expired).toBe(false);
  });
});

describe("queries that fail", () => {
  afterEach(() => {
    queryClient.clear();
    useProblems.setState({ list: [], open: false, focus: null, pings: 0 });
    useConnection.setState({ offline: false, backAt: null, expired: false, asking: false });
  });

  /** A part on screen asking for its list; resolves once the query settles. */
  function watch(key: readonly unknown[], answer: () => Promise<unknown>) {
    const observer = new QueryObserver(queryClient, {
      queryKey: key,
      queryFn: answer,
      retry: false,
    });
    return new Promise<() => void>((done) => {
      const stop = observer.subscribe((result) => {
        if (result.status !== "pending" && result.fetchStatus === "idle") done(stop);
      });
    });
  }

  it("become a problem, which the next success solves", async () => {
    let fail = true;
    const answer = () =>
      fail ? Promise.reject(new ApiError("api", "502", 502)) : Promise.resolve({ items: [] });
    const stop = await watch(["library", "playlists"], answer);
    const [problem] = useProblems.getState().list;
    expect(problem?.title).toBe("Плейлисты не загрузились");
    expect(problem?.retry).toBeTypeOf("function");

    fail = false;
    await queryClient.refetchQueries({ queryKey: ["library", "playlists"] });
    expect(useProblems.getState().list.filter(isActive)).toHaveLength(0);
    stop();
  });

  it("without a network, mark the app offline and load by themselves later", async () => {
    const stop = await watch(["library", "history"], () =>
      Promise.reject(new ApiError("network", "dns")),
    );
    expect(useConnection.getState().offline).toBe(true);
    const [problem] = useProblems.getState().list;
    expect(problem?.title).toBe("История не успела загрузиться");
    expect(problem?.retry).toBeUndefined();
    stop();
  });

  it("with a refused sign-in, ask for it once instead of listing every part", async () => {
    const stop = await watch(["library", "likes"], () =>
      Promise.reject(new ApiError("unauthorized", "refused", 401)),
    );
    expect(useConnection.getState().expired).toBe(true);
    expect(useProblems.getState().list.map((p) => p.id)).toEqual(["session"]);
    stop();
  });

  it("stay quiet when nobody on screen asked", async () => {
    await queryClient
      .fetchQuery({
        queryKey: ["playlist", 1],
        queryFn: () => Promise.reject(new ApiError("api", "502", 502)),
        retry: false,
      })
      .catch(() => {});
    expect(useProblems.getState().list).toHaveLength(0);
  });
});
