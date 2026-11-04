import { call } from "@/api/invoke";
import type {
  DiaryCity,
  DiaryPage,
  DiarySettings,
  Heard,
  PlayOutcome,
  PlaySource,
  Track,
} from "@/api/types";

// The listening diary: a file on this computer that only Rust reads and writes.
// Nothing here goes to SoundCloud or anywhere else.

/** A play whose sound has just started. */
export interface StartPlay {
  track: Track;
  source: PlaySource;
  /** Put next by hand («Играть следующим»). */
  added: boolean;
  /** Where in the track the sound began. */
  fromMs: number;
}

/** Writes down a play that has just started sounding; resolves to its id. */
export function diaryStart(play: StartPlay): Promise<number> {
  return call<number>("diary_start", { play });
}

/** How far a play has got. */
export function diaryProgress(id: number, heard: Heard): Promise<void> {
  return call<void>("diary_progress", { id, heard });
}

/** Closes a play with how it ended; a closed play stays as it was. */
export function diaryEnd(id: number, outcome: PlayOutcome, heard: Heard): Promise<void> {
  return call<void>("diary_end", { id, outcome, heard });
}

/** The track was liked, or the like taken back, while this play went on. */
export function diaryLiked(id: number, liked: boolean): Promise<void> {
  return call<void>("diary_liked", { id, liked });
}

/** Plays, newest first; `before` is the `next` of the page before. */
export function diaryPlays(before: string | null = null, limit?: number): Promise<DiaryPage> {
  return call<DiaryPage>("diary_plays", { before, limit: limit ?? null });
}

/** How long plays are kept, the place the sun is worked out for, how much is kept. */
export function diarySettings(): Promise<DiarySettings> {
  return call<DiarySettings>("diary_settings");
}

/** Keeps plays this many days (`null`: always); resolves to how many older ones went. */
export function diaryKeep(days: number | null): Promise<number> {
  return call<number>("diary_keep", { days });
}

/** Names the city the sun is worked out for; `null` goes back to the time zone. */
export function diaryCity(city: DiaryCity | null): Promise<void> {
  return call<void>("diary_city", { city });
}

/** Takes one play out of the diary. */
export function diaryForget(id: number): Promise<void> {
  return call<void>("diary_forget", { id });
}

/** Erases every play; how long to keep and the city stay. */
export function diaryClear(): Promise<void> {
  return call<void>("diary_clear");
}
