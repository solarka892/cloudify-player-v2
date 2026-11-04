import type { Track } from "@/api/types";

export type MoodId = "usual" | "fav" | "new" | "up" | "calm";

export interface Mood {
  id: MoodId;
  label: string;
  /** The line under «Подборка»: what this mood plays, truthfully. */
  line: (likesCount: string | null) => string;
  /** How the light moves: height of the swell, speed, and a turn of the cover's hues. */
  light: { energy: number; pace: number; hueShift: number };
}

export const MOODS: readonly Mood[] = [
  {
    id: "usual",
    label: "Как обычно",
    line: (likes) =>
      `Бесконечно, из твоих ${likes ? `${likes} ` : ""}лайков и того, что ты слушаешь. Скипнутое сюда не вернётся.`,
    light: { energy: 1, pace: 1, hueShift: 0 },
  },
  {
    id: "fav",
    label: "Любимое",
    line: () => "Только твои лайки, вперемешку.",
    light: { energy: 0.85, pace: 0.8, hueShift: 0 },
  },
  {
    id: "new",
    label: "Незнакомое",
    line: () => "Похожее на то, что ты слушаешь, — от артистов, которых нет в твоих лайках.",
    light: { energy: 1.1, pace: 1.2, hueShift: 140 },
  },
  {
    id: "up",
    label: "Бодрее",
    line: () => "Быстрее и громче: под дорогу, зал или уборку.",
    light: { energy: 1.45, pace: 2.1, hueShift: -25 },
  },
  {
    id: "calm",
    label: "Спокойнее",
    line: () => "Тише и медленнее: на ночь или чтобы сосредоточиться.",
    light: { energy: 0.55, pace: 0.45, hueShift: 60 },
  },
];

export function moodById(id: MoodId): Mood {
  return MOODS.find((mood) => mood.id === id) ?? (MOODS[0] as Mood);
}

// SoundCloud gives no tempo or energy, so «бодрее» and «спокойнее» go by the
// genres and tags uploaders set. A rule, not a model: a track without telling
// genre or tags simply doesn't count for either.
const UPBEAT = [
  "phonk",
  "drum & bass",
  "drum and bass",
  "dnb",
  "jungle",
  "techno",
  "hardstyle",
  "house",
  "edm",
  "dubstep",
  "trap",
  "drill",
  "hyperpop",
  "breakbeat",
  "garage",
  "electro",
  "rock",
  "metal",
  "punk",
  "rave",
  "dance",
  "workout",
];
const CALM = [
  "ambient",
  "lo-fi",
  "lofi",
  "chill",
  "downtempo",
  "piano",
  "classical",
  "acoustic",
  "jazz",
  "sleep",
  "meditation",
  "folk",
  "instrumental",
  "soundtrack",
  "dream pop",
  "shoegaze",
  "lounge",
];

function describedAs(track: Track, words: readonly string[]): boolean {
  const labels = [track.genre ?? "", ...track.tags].map((label) => label.toLowerCase());
  return labels.some((label) => label && words.some((word) => label.includes(word)));
}

export const isUpbeat = (track: Track) => describedAs(track, UPBEAT) && !describedAs(track, CALM);
export const isCalm = (track: Track) => describedAs(track, CALM) && !describedAs(track, UPBEAT);
