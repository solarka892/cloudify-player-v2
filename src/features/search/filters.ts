import type { CreatedWithin, DurationFilter, LicenseFilter, TrackFilters } from "@/api/types";

// The track filters as the filter column offers them, in plain words.

export const DURATIONS: readonly (readonly [DurationFilter, string])[] = [
  ["short", "до 2 мин"],
  ["medium", "2–10 мин"],
  ["long", "10–30 мин"],
  ["epic", "30+ мин"],
];

export const CREATED: readonly (readonly [CreatedWithin, string])[] = [
  ["last-hour", "за час"],
  ["last-day", "за день"],
  ["last-week", "за неделю"],
  ["last-month", "за месяц"],
  ["last-year", "за год"],
];

export const LICENSES: readonly (readonly [LicenseFilter, string])[] = [
  ["to-share", "Можно делиться"],
  ["to-use-commercially", "Можно в платных проектах"],
  ["to-modify-commercially", "Можно переделывать для платных"],
];

/** The filters with nothing unset left in, so equal choices make equal cache keys. */
export function cleanFilters(filters: TrackFilters): TrackFilters {
  const clean: TrackFilters = {};
  if (filters.genre?.trim()) clean.genre = filters.genre.trim().toLowerCase();
  if (filters.duration) clean.duration = filters.duration;
  if (filters.created) clean.created = filters.created;
  if (filters.license) clean.license = filters.license;
  if (filters.goPlusOnly) clean.goPlusOnly = true;
  return clean;
}

export function hasFilters(filters: TrackFilters): boolean {
  return Object.keys(cleanFilters(filters)).length > 0;
}

/** SoundCloud counts genres in lower case; shown with a capital: «Hip-hop & rap». */
export function genreName(genre: string): string {
  return genre.charAt(0).toUpperCase() + genre.slice(1);
}
