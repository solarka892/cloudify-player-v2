// Development only: the listening diary, answered in memory so the «Дневник»
// screen and the player's recording work in a plain browser tab. It starts
// with two weeks of made-up listening over the stand-in tracks (evenings and
// nights, the odd morning), and what the browser plays is added on top. The
// sun here is a rough Moscow curve, not the Rust sums: only the shapes matter.

import { ApiError } from "@/api/invoke";
import type {
  DaySummary,
  DiaryCity,
  DiaryPage,
  DiarySettings,
  Heard,
  PartOfDay,
  Play,
  PlayOutcome,
  PlaySetting,
  PlaySource,
  Track,
  Weekday,
} from "@/api/types";

const DAY = 86_400_000;
const MOSCOW = 180;
const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

interface Stored extends Play {
  updatedAt: number;
}

let plays: Stored[] = [];
let nextId = 1;
let keepDays: number | null = null;
let city: DiaryCity | null = null;
let seeded = false;

function partOf(hour: number): PartOfDay {
  return hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "day" : "evening";
}

/** Roughly Moscow's day length and sun, enough to look right in a browser. */
function settingAt(utc: number, lat = city?.lat ?? 55.8): PlaySetting {
  const local = new Date(utc + MOSCOW * 60_000);
  const hour = local.getUTCHours() + local.getUTCMinutes() / 60;
  const start = Date.UTC(local.getUTCFullYear(), 0, 0);
  const doy = (local.getTime() - start) / DAY;
  const swing = 5.3 * ((lat - 0) / 55.8);
  const daylight =
    Math.round((12.2 + swing * Math.sin((2 * Math.PI * (doy - 80)) / 365)) * 10) / 10;
  const noon = 12.4;
  const fromNoon = Math.abs(hour - noon);
  const sun = Math.round(
    (90 - lat + 23.4 * Math.sin((2 * Math.PI * (doy - 80)) / 365)) *
      Math.cos((Math.PI * Math.min(fromNoon, 12)) / 12) -
      (fromNoon > daylight / 2 ? 8 : 0),
  );
  const month = local.getUTCMonth() + 1;
  return {
    tod: partOf(local.getUTCHours()),
    dow: WEEKDAYS[local.getUTCDay()] ?? "mon",
    season:
      month <= 2 || month === 12
        ? "winter"
        : month <= 5
          ? "spring"
          : month <= 8
            ? "summer"
            : "autumn",
    daylight,
    sun,
    rise: Math.round((noon - daylight / 2) * 60),
    set: Math.round((noon + daylight / 2) * 60),
    lat: Math.round(lat * 10) / 10,
    place: city ? "city" : "zone",
    weather: null,
    activity: null,
    mood: null,
  };
}

/** A repeatable random number from 0 to 1. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

const SOURCES: PlaySource[] = [
  { kind: "selection", title: null, id: null },
  { kind: "likes", title: null, id: null },
  { kind: "likes", title: null, id: null },
  { kind: "playlist", title: "ночь на 14-е", id: 1 },
  { kind: "playlist", title: "фонк в зал", id: 2 },
  { kind: "search", title: "molchat doma", id: null },
];

/** Two weeks of listening: one to three sittings a day, each a run through one source. */
function seed(tracks: readonly Track[]) {
  if (seeded || tracks.length === 0) return;
  seeded = true;
  const next = random(14);
  const today = Math.floor((Date.now() + MOSCOW * 60_000) / DAY) * DAY - MOSCOW * 60_000;
  for (let back = 13; back >= 0; back -= 1) {
    const sittings = 1 + Math.floor(next() * 3);
    const starts = [8.5, 15, 19.5, 23.2].sort(() => next() - 0.5).slice(0, sittings);
    for (const hour of starts.sort((a, b) => a - b)) {
      let at = today - back * DAY + hour * 3_600_000 + Math.floor(next() * 40) * 60_000;
      if (at > Date.now() - 20 * 60_000) continue;
      const source = SOURCES[Math.floor(next() * SOURCES.length)] as PlaySource;
      const count = 4 + Math.floor(next() * 9);
      for (let i = 0; i < count; i += 1) {
        const track = tracks[Math.floor(next() * tracks.length)] as Track;
        const length = track.durationMs;
        const roll = next();
        const outcome: PlayOutcome =
          roll < 0.56
            ? "finished"
            : roll < 0.84
              ? "skipped"
              : roll < 0.9
                ? "rejected"
                : roll < 0.96
                  ? "again"
                  : "stopped";
        const position =
          outcome === "finished" || outcome === "again"
            ? length
            : outcome === "stopped"
              ? Math.floor(length * (0.3 + next() * 0.5))
              : Math.floor(1000 * (3 + next() * (next() < 0.6 ? 30 : length / 1000 - 20)));
        const ended = at + position;
        plays.push({
          id: nextId++,
          track,
          startedAt: at,
          utcOffset: MOSCOW,
          endedAt: ended,
          outcome,
          fromMs: 0,
          positionMs: position,
          listenedMs: position,
          durationMs: length,
          liked: next() < 0.06,
          source,
          added: next() < 0.05,
          setting: settingAt(at),
          updatedAt: ended,
        });
        at = ended + 2_000;
      }
    }
  }
}

function prune(now = Date.now()) {
  if (keepDays === null) return 0;
  const cutoff = now - keepDays * DAY;
  const before = plays.length;
  plays = plays.filter((play) => play.startedAt >= cutoff);
  return before - plays.length;
}

/** As Rust does: a play that is gone (erased, forgotten) takes no more writes, quietly. */
function find(id: unknown): Stored {
  return plays.find((p) => p.id === id) ?? ({} as Stored);
}

/** The diary's commands; `undefined` for any other command. */
export function answerDiary(
  command: string,
  args: Record<string, unknown>,
  tracks: readonly Track[],
): unknown {
  if (!command.startsWith("diary_")) return undefined;
  seed(tracks);
  const now = Date.now();
  switch (command) {
    case "diary_start": {
      const start = args.play as {
        track: Track;
        source: PlaySource;
        added: boolean;
        fromMs: number;
      };
      for (const open of plays.filter((p) => p.outcome === null)) {
        open.outcome = "stopped";
        open.endedAt = open.updatedAt;
      }
      const play: Stored = {
        id: nextId++,
        track: { ...start.track, description: null },
        startedAt: now,
        utcOffset: -new Date(now).getTimezoneOffset(),
        endedAt: null,
        outcome: null,
        fromMs: start.fromMs,
        positionMs: start.fromMs,
        listenedMs: 0,
        durationMs: start.track.durationMs,
        liked: false,
        source: start.source,
        added: start.added,
        setting: settingAt(now),
        updatedAt: now,
      };
      plays.push(play);
      return play.id;
    }
    case "diary_progress": {
      const play = find(args.id);
      const heard = args.heard as Heard;
      if (play.outcome === null) {
        play.positionMs = heard.positionMs;
        play.listenedMs = Math.max(play.listenedMs, heard.listenedMs);
        play.updatedAt = now;
      }
      return null;
    }
    case "diary_end": {
      const play = find(args.id);
      const heard = args.heard as Heard;
      if (play.outcome === null) {
        play.outcome = args.outcome as PlayOutcome;
        play.positionMs = heard.positionMs;
        play.listenedMs = Math.max(play.listenedMs, heard.listenedMs);
        play.endedAt = now;
        play.updatedAt = now;
      }
      return null;
    }
    case "diary_liked":
      find(args.id).liked = Boolean(args.liked);
      return null;
    case "diary_plays": {
      const words = typeof args.find === "string" ? args.find.trim().toLowerCase() : "";
      const sorted = [...plays]
        .filter(
          (p) =>
            !words ||
            p.track.title.toLowerCase().includes(words) ||
            (p.track.user?.username ?? "").toLowerCase().includes(words),
        )
        .sort((a, b) => b.startedAt - a.startedAt || b.id - a.id);
      const before = typeof args.before === "string" ? args.before.split(":").map(Number) : null;
      const from = before
        ? sorted.filter(
            (p) =>
              p.startedAt < (before[0] ?? 0) ||
              (p.startedAt === before[0] && p.id < (before[1] ?? 0)),
          )
        : sorted;
      const limit = typeof args.limit === "number" ? args.limit : 200;
      const items = from.slice(0, limit).map(({ updatedAt: _, ...play }) => play);
      const last = items.at(-1);
      const page: DiaryPage = {
        items,
        next: from.length > limit && last ? `${last.startedAt}:${last.id}` : null,
      };
      return page;
    }
    case "diary_days": {
      const days = new Map<string, DaySummary>();
      for (const p of plays) {
        const day = new Date(p.startedAt + p.utcOffset * 60_000).toISOString().slice(0, 10);
        const summary = days.get(day) ?? { day, plays: 0, heardMs: 0 };
        summary.plays += 1;
        summary.heardMs += p.listenedMs;
        days.set(day, summary);
      }
      const limit = typeof args.limit === "number" ? args.limit : 31;
      return [...days.values()].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, limit);
    }
    case "diary_settings": {
      const settings: DiarySettings = {
        keepDays,
        city,
        zone: { zone: "Europe/Moscow", lat: 55.8, lon: 37.6 },
        plays: plays.length,
        since: plays.reduce<number | null>(
          (oldest, p) => (oldest === null || p.startedAt < oldest ? p.startedAt : oldest),
          null,
        ),
      };
      return settings;
    }
    case "diary_keep":
      keepDays = typeof args.days === "number" ? args.days : null;
      return prune(now);
    case "diary_city":
      city = (args.city as DiaryCity | null) ?? null;
      return null;
    case "diary_forget":
      plays = plays.filter((p) => p.id !== args.id);
      return null;
    case "diary_clear":
      plays = [];
      return null;
    default:
      throw new ApiError("app", `dev backend: no stand-in for ${command}`);
  }
}
