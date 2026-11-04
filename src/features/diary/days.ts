import type { PartOfDay, Play, PlaySource } from "@/api/types";
import { formatSeconds } from "@/ui/format";

// The diary read the way people remember: by days, and inside a day by its
// night, morning, day and evening, newest first. A play is placed by the clock
// where it was played (its own offset), so the evenings of a trip stay evenings.

const MINUTE = 60_000;
const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
const WEEKDAYS = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];
const PART_NAMES: Record<PartOfDay, string> = {
  night: "Ночь",
  morning: "Утро",
  day: "День",
  evening: "Вечер",
};

const pad = (n: number) => String(n).padStart(2, "0");
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The wall clock a play started at, read with the UTC getters. */
const wall = (play: Play) => new Date(play.startedAt + play.utcOffset * MINUTE);

/** The day a play belongs to on its own clock: `2026-11-04`. */
export function dayOf(play: Play): string {
  return wall(play).toISOString().slice(0, 10);
}

/** When it started on its own clock: `03:40`. */
export function clockOf(play: Play): string {
  const at = wall(play);
  return `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
}

/** When it stopped sounding (or sounds now), on its own clock. */
function endClockOf(play: Play): string {
  const at = new Date((play.endedAt ?? play.startedAt + play.listenedMs) + play.utcOffset * MINUTE);
  return `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
}

export function partOf(play: Play): PartOfDay {
  const hour = wall(play).getUTCHours();
  return hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "day" : "evening";
}

/** Today on this computer's clock: `2026-11-04`. */
export function todayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const dateOfKey = (key: string) => new Date(`${key}T00:00:00Z`);

function shiftKey(key: string, days: number): string {
  const at = dateOfKey(key);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/** «Сегодня», «Вчера», else the weekday: «Понедельник». */
export function dayWord(key: string, today: string): string {
  if (key === today) return "Сегодня";
  if (key === shiftKey(today, -1)) return "Вчера";
  return capital(WEEKDAYS[dateOfKey(key).getUTCDay()] ?? "");
}

/** «4 ноября», with the year once it is not this one: «4 ноября 2025». */
export function dayDate(key: string, today: string): string {
  const at = dateOfKey(key);
  const date = `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
  return key.slice(0, 4) === today.slice(0, 4) ? date : `${date} ${key.slice(0, 4)}`;
}

/** The day of the month alone, for the strip of days. */
export function dayNumber(key: string): number {
  return dateOfKey(key).getUTCDate();
}

/** Monday starts a week on the strip of days. */
export function isMonday(key: string): boolean {
  return dateOfKey(key).getUTCDay() === 1;
}

export function isWeekend(key: string): boolean {
  const day = dateOfKey(key).getUTCDay();
  return day === 0 || day === 6;
}

/** The `count` days up to and including `last`, oldest first. */
export function daysUpTo(last: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftKey(last, i - count + 1));
}

/** «Ночь на 4-е» (a night belongs to the day it ends in), «Утро», «День», «Вечер». */
export function partName(part: PartOfDay, key: string): string {
  return part === "night" ? `Ночь на ${dayNumber(key)}-е` : PART_NAMES[part];
}

/** What the player names a part played again: «ночь на 4-е», «вечер 3 ноября». */
export function partTitle(part: PartOfDay, key: string, today: string): string {
  return part === "night"
    ? partName(part, key).toLowerCase()
    : `${PART_NAMES[part].toLowerCase()} ${dayDate(key, today)}`;
}

/** Light, dusk (the sun under the horizon by up to 6°) or dark, by the sun's height. */
export type Sky = "light" | "dusk" | "dark";

export function skyOf(sun: number | null): Sky | null {
  if (sun === null) return null;
  return sun > 0 ? "light" : sun > -6 ? "dusk" : "dark";
}

export const SKY_WORDS: Record<Sky, string> = { light: "светло", dusk: "сумерки", dark: "темно" };

/** A minute of the day as a clock: 462 → «7:42». */
export function minuteClock(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

/** «9 ч 02 мин»: how long the light lasted. */
export function lightLength(rise: number, set: number): string {
  const minutes = (set - rise + 1440) % 1440;
  return `${Math.floor(minutes / 60)} ч ${pad(minutes % 60)} мин`;
}

export interface PartGroup {
  /** `2026-11-04:night`. */
  key: string;
  day: string;
  part: PartOfDay;
  name: string;
  /** Newest first. */
  plays: Play[];
  /** «00:22–03:41». */
  span: string;
  heardMs: number;
  finished: number;
  /** What the sky was through most of it, when the place was known. */
  sky: Sky | null;
}

export interface DayGroup {
  key: string;
  count: number;
  heardMs: number;
  /** Sunrise and sunset on the day's clock, in minutes, when known. */
  rise: number | null;
  set: number | null;
  /** Newest first: evening, day, morning, night. */
  parts: PartGroup[];
}

const isFinished = (play: Play) => play.outcome === "finished" || play.outcome === "again";

/** Plays (newest first) as days of parts, newest first all the way down. */
export function groupDays(plays: readonly Play[]): DayGroup[] {
  const days: DayGroup[] = [];
  const index = new Map<string, DayGroup>();
  const parts = new Map<string, PartGroup>();
  for (const play of plays) {
    const key = dayOf(play);
    let day = index.get(key);
    if (!day) {
      day = { key, count: 0, heardMs: 0, rise: null, set: null, parts: [] };
      index.set(key, day);
      days.push(day);
    }
    day.count += 1;
    day.heardMs += play.listenedMs;
    if (day.rise === null && play.setting.rise !== null && play.setting.set !== null) {
      day.rise = play.setting.rise;
      day.set = play.setting.set;
    }
    const part = partOf(play);
    const partKey = `${key}:${part}`;
    let group = parts.get(partKey);
    if (!group) {
      group = {
        key: partKey,
        day: key,
        part,
        name: partName(part, key),
        plays: [],
        span: "",
        heardMs: 0,
        finished: 0,
        sky: null,
      };
      parts.set(partKey, group);
      day.parts.push(group);
    }
    group.plays.push(play);
    group.heardMs += play.listenedMs;
    if (isFinished(play)) group.finished += 1;
  }
  for (const group of parts.values()) {
    const newest = group.plays[0];
    const oldest = group.plays.at(-1);
    if (newest && oldest) group.span = `${clockOf(oldest)}–${endClockOf(newest)}`;
    const skies = new Map<Sky, number>();
    for (const play of group.plays) {
      const sky = skyOf(play.setting.sun);
      if (sky) skies.set(sky, (skies.get(sky) ?? 0) + 1);
    }
    group.sky = [...skies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  return days;
}

/** How a play ended, as a row says it, with how far it got (0…1). */
export interface Ending {
  tone: "done" | "left" | "live";
  text: string;
  share: number;
  /** Heard to the end and started again. */
  again: boolean;
}

/**
 * `live`: where the player is in it now, when it is the one sounding. An open
 * play the player is not on (the window was reloaded mid-song) reads as
 * stopped, which is how it will be closed.
 */
export function endingOf(play: Play, live?: { position: number; playing: boolean }): Ending {
  const length = Math.max(1, play.durationMs);
  const at = (ms: number) => formatSeconds(ms / 1000);
  switch (play.outcome) {
    case null: {
      if (!live) return endingOf({ ...play, outcome: "stopped" });
      return {
        tone: "live",
        text: `${live.playing ? "играет" : "на паузе"} · ${at(live.position * 1000)}`,
        share: (live.position * 1000) / length,
        again: false,
      };
    }
    case "finished":
      return { tone: "done", text: "дослушал", share: 1, again: false };
    case "again":
      return { tone: "done", text: "дослушал", share: 1, again: true };
    case "skipped":
      return {
        tone: "left",
        text: `пропустил на ${at(play.positionMs)}`,
        share: play.positionMs / length,
        again: false,
      };
    case "rejected":
      return {
        tone: "left",
        text: `«не то» на ${at(play.positionMs)}`,
        share: play.positionMs / length,
        again: false,
      };
    case "stopped":
      return {
        tone: "left",
        text: `остановил на ${at(play.positionMs)}`,
        share: play.positionMs / length,
        again: false,
      };
  }
}

/** Where a play came from, as a row says it: «из лайков», ««ночь на 14-е»». */
export function sourceWords(source: PlaySource): string {
  switch (source.kind) {
    case "selection":
      return "подборка";
    case "likes":
      return "из лайков";
    case "playlist":
      return source.title ? `«${source.title}»` : "из плейлиста";
    case "history":
      return "из истории";
    case "reposts":
      return "из репостов";
    case "artist":
      return source.title ? `популярное · ${source.title}` : "популярное артиста";
    case "station":
      return source.title ? `радио · ${source.title}` : "радио";
    case "search":
      return source.title ? `поиск «${source.title}»` : "из поиска";
    case "resume":
      return "с прошлого раза";
    case "diary":
      return source.title ? `из дневника · ${source.title}` : "из дневника";
    case "other":
      return "";
  }
}
