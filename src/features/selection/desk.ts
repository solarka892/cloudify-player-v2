import {
  NOVELTY_STEPS,
  type Seed,
  SOURCES,
  type SourceCount,
  type SourceId,
  type SourceSetting,
} from "@/features/selection/engine";
import type { Evidence, Taste } from "@/features/selection/taste";
import { monthYear } from "@/features/selection/why";
import { formatCount, plural } from "@/ui/format";

// The words of «Настроить подборку»: what the balance means, what each source
// holds now (or honestly why it holds nothing yet), and what the diary taught.
// Only counts the engine itself uses. Russian for now, like the rest.

const ORDINAL: Record<number, string> = {
  2: "второй",
  3: "третий",
  4: "четвёртый",
  6: "шестой",
  12: "двенадцатый",
};
const every = (n: number) => ORDINAL[n] ?? `${n}-й`;

/** What a position of the balance means, in one sentence. */
export function sayMix(novelty: number): string {
  if (novelty <= 0) return "Только знакомое: лайки, история и дневник";
  if (novelty >= NOVELTY_STEPS) return "Только новое: станции и похожие треки";
  if (novelty * 2 === NOVELTY_STEPS) return "Поровну знакомого и нового";
  if (novelty * 2 < NOVELTY_STEPS) {
    return `Каждый ${every(Math.round(NOVELTY_STEPS / novelty))} трек — новый`;
  }
  return `Каждый ${every(Math.round(NOVELTY_STEPS / (NOVELTY_STEPS - novelty)))} трек — знакомый, остальное новое`;
}

const tracks = (n: number) => `${formatCount(n)} ${plural(n, ["трек", "трека", "треков"])}`;
const titles = (seeds: readonly Seed[]) =>
  seeds
    .slice(0, 2)
    .map((seed) => `«${seed.track.title}»`)
    .join(", ");

export const SOURCE_NAMES: Readonly<Record<SourceId, string>> = {
  likes: "Лайки",
  history: "История",
  winter: "Прошлой зимой",
  yearAgo: "Эта неделя год назад",
  stations: "Станции",
  related: "Похожие треки",
};

/** What the desk knows when it describes the sources. */
export interface SourcesInput {
  likes: number;
  counts: Readonly<Record<SourceId, SourceCount>> | null;
  settings: Readonly<Record<SourceId, SourceSetting>>;
  stations: readonly Seed[];
  related: readonly Seed[];
  /** Plays the diary has taught from. */
  plays: number;
  /** When the diary's oldest play started; `null` when it is empty. */
  since: number | null;
  windows: { winter: { from: number; to: number }; yearAgo: { from: number; to: number } } | null;
  now: number;
}

export interface SourceRow extends SourceSetting {
  id: SourceId;
  name: string;
  /** What it holds now, or why it holds nothing. */
  line: string;
  /** Nothing to offer yet: the weight does not apply. */
  empty: boolean;
}

const YEAR_MS = 365.25 * 86_400_000;

/** Every source as the desk lists it, in the engine's order. */
export function sourceRows(input: SourcesInput): SourceRow[] {
  const offered = (id: SourceId) => input.counts?.[id].offered ?? 0;
  const since = input.since ?? input.now;
  return SOURCES.map((id): SourceRow => {
    let line: string;
    let empty = false;
    switch (id) {
      case "likes":
        empty = input.likes === 0;
        line = empty
          ? "Пусто: поставь пару лайков на SoundCloud"
          : `${tracks(input.likes)} · недавно игравшие — в конце`;
        break;
      case "history":
        empty = offered(id) === 0;
        line = !empty
          ? `${tracks(offered(id))}, которые ты обычно дослушиваешь`
          : input.plays === 0
            ? "Пусто: история придёт, когда дневник узнает, что из неё ты дослушиваешь"
            : "Пусто: из истории ты пока ничего не дослушивал";
        break;
      case "stations": {
        const reason = input.stations[0]?.reason;
        empty = input.stations.length === 0;
        line =
          reason === "finished"
            ? `По ${titles(input.stations)} — ${input.stations.length > 1 ? "их" : "его"} ты дослушал недавно`
            : reason === "played"
              ? `По ${titles(input.stations)} — его ты включал последним`
              : reason === "liked"
                ? `По ${titles(input.stations)} — твоему последнему лайку`
                : "Пусто: не от чего начать — нет ни истории, ни лайков";
        break;
      }
      case "related":
        empty = input.related.length === 0;
        line = empty
          ? "Пусто: появятся, когда дослушаешь первый трек"
          : `Рядом с ${titles(input.related)}`;
        break;
      case "winter":
      case "yearAgo": {
        const window = input.windows?.[id];
        empty = offered(id) === 0;
        if (!empty) {
          line =
            id === "winter"
              ? `${tracks(offered(id))}, которые ты дослушивал прошлой зимой`
              : `${tracks(offered(id))} с той же недели год назад`;
        } else if (!window || since > window.from) {
          // The diary does not reach back that far yet: say when it will.
          // A few days past the date, so a time zone never tips it into the month before.
          const ready = (id === "winter" && window ? window.to : since) + YEAR_MS + 3 * 86_400_000;
          line =
            id === "winter"
              ? `Пусто: появится ${monthYear(ready)} — после первой зимы с дневником`
              : `Пусто: появится ${monthYear(ready)}, когда дневнику будет год`;
        } else {
          line =
            id === "winter"
              ? "Пусто: прошлой зимой ты здесь ничего не дослушал"
              : "Пусто: в эту неделю год назад ты здесь ничего не дослушал";
        }
        break;
      }
    }
    return { id, name: SOURCE_NAMES[id], ...input.settings[id], line, empty };
  });
}

/** One artist the diary knows, with the counts that say how it goes. */
export interface ArtistFact {
  id: number;
  name: string;
  plays: number;
  /** Heard to the end, started over, or left in the last quarter. */
  heardOut: number;
  /** Left within the first half-minute. */
  early: number;
}

export interface Known {
  plays: number;
  /** Artists heard out most, surest first. */
  loved: ArtistFact[];
  /** Artists mostly left in seconds. */
  left: ArtistFact[];
  /** Tracks sent away with «не то». */
  rejected: number;
}

const heardOut = (e: Evidence) => e.finished + e.again + e.late;

/** What the diary has taught, in the engine's own counts. */
export function whatItKnows(taste: Taste | null, names: ReadonlyMap<number, string>): Known {
  if (!taste) return { plays: 0, loved: [], left: [], rejected: 0 };
  const facts = [...taste.artists.entries()].flatMap(([id, e]): ArtistFact[] => {
    const name = names.get(id);
    return name ? [{ id, name, plays: e.plays, heardOut: heardOut(e), early: e.early }] : [];
  });
  // Few plays are little proof: two plays' worth of doubt before the share speaks.
  const sure = (a: ArtistFact) => a.heardOut / (a.plays + 2);
  const loved = facts
    .filter((a) => a.plays >= 3 && a.heardOut * 2 >= a.plays)
    .sort((a, b) => sure(b) - sure(a) || b.plays - a.plays)
    .slice(0, 4);
  const left = facts
    .filter((a) => a.early >= 2 && a.early * 2 >= a.plays)
    .sort((a, b) => b.early - a.early || b.plays - a.plays)
    .slice(0, 3);
  const rejected = [...taste.tracks.values()].filter((e) => e.rejected > 0).length;
  return { plays: taste.plays, loved, left, rejected };
}
