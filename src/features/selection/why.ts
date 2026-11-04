import type { Fact, Seed } from "@/features/selection/engine";
import { plural } from "@/ui/format";

// The «почему» line under the playing track. It only words facts the engine
// worked out (where the track came from, what you did with it); it never adds
// one. Russian for now; this moves into the i18n dictionary when it exists.

const MONTHS_OF = [
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
const MONTHS_IN = [
  "январе",
  "феврале",
  "марте",
  "апреле",
  "мае",
  "июне",
  "июле",
  "августе",
  "сентябре",
  "октябре",
  "ноябре",
  "декабре",
];
const WEEKDAYS_ON = [
  "в воскресенье",
  "в понедельник",
  "во вторник",
  "в среду",
  "в четверг",
  "в пятницу",
  "в субботу",
];

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** «ночью», «утром», «днём», «вечером»: the part of the day an hour falls in. */
function partOfDay(hour: number): string {
  if (hour < 6) return "ночью";
  if (hour < 12) return "утром";
  if (hour < 18) return "днём";
  return "вечером";
}

/** When something happened, as a person says it: «сегодня утром», «вчера», «в субботу», «12 октября». */
export function when(at: number, now: number): string {
  const then = new Date(at);
  const today = new Date(now);
  const days = Math.round((startOfDay(today) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return `сегодня ${partOfDay(then.getHours())}`;
  if (days === 1) return `вчера ${partOfDay(then.getHours())}`;
  if (days === 2) return "позавчера";
  if (days < 7) return WEEKDAYS_ON[then.getDay()] as string;
  const date = `${then.getDate()} ${MONTHS_OF[then.getMonth()]}`;
  return then.getFullYear() === today.getFullYear() ? date : `${date} ${then.getFullYear()}`;
}

/** A month ahead, always with its year: «в марте 2027». */
export function monthYear(at: number): string {
  const then = new Date(at);
  return `в ${MONTHS_IN[then.getMonth()]} ${then.getFullYear()}`;
}

/** The month something last happened in: «в августе», «в августе 2025». */
function inMonth(at: number, now: number): string {
  const then = new Date(at);
  const month = `в ${MONTHS_IN[then.getMonth()]}`;
  return then.getFullYear() === new Date(now).getFullYear()
    ? month
    : `${month} ${then.getFullYear()}`;
}

const times = (n: number) => `${n} ${plural(n, ["раз", "раза", "раз"])}`;

function grownFrom(seed: Seed, now: number, related: boolean): string {
  const title = `«${seed.track.title}»`;
  switch (seed.reason) {
    case "finished":
      return seed.at === null
        ? `Похож на ${title} — его ты дослушал`
        : `Похож на ${title} — ты дослушал его ${when(seed.at, now)}`;
    case "more":
      return `Похож на ${title} — ты просил больше такого`;
    case "played":
      return related
        ? `Похож на ${title} — его ты включал последним`
        : `Со станции по ${title} — его ты включал последним`;
    case "liked":
      return related
        ? `Похож на ${title} — твой последний лайк`
        : `Со станции по ${title} — твой последний лайк`;
  }
}

/** Where the track came from, in words; `null` for facts that are not about that. */
function whereFrom(fact: Fact, now: number): string | null {
  switch (fact.kind) {
    case "more":
      return `Ты просил больше такого, как «${fact.track.title}»`;
    case "station":
      return grownFrom(fact.seed, now, false);
    case "related":
      return grownFrom(fact.seed, now, true);
    case "winter":
      return fact.times > 1
        ? `Прошлой зимой ты слушал его ${times(fact.times)}`
        : "Прошлой зимой ты его слушал";
    case "yearAgo":
      return fact.times > 1
        ? `Эту неделю год назад ты слушал его ${times(fact.times)}`
        : "Эту неделю год назад ты слушал то же";
    case "history":
      return fact.at === null ? "Из твоей истории" : `Из истории: слушал ${when(fact.at, now)}`;
    case "liked":
      return "Из твоих лайков";
    default:
      return null;
  }
}

/** What you did with it, in words; `null` for facts about where it came from. */
function whatYouDid(fact: Fact, now: number): string | null {
  switch (fact.kind) {
    case "finished":
      return fact.times === fact.of
        ? fact.of === 1
          ? "ты дослушал его"
          : `дослушал все ${fact.of}`
        : `дослушал ${fact.times} из ${fact.of}`;
    case "again":
      return `ставил на повтор ${times(fact.times)}`;
    case "missed":
      return `давно не слышал — последний раз ${inMonth(fact.at, now)}`;
    case "artist":
      return `${fact.name}: дослушиваешь ${fact.finished} из ${fact.plays}`;
    case "stranger":
      return "новый для тебя артист";
    case "rules":
      return "пока по правилам — тебя ещё не выучил";
    default:
      return null;
  }
}

/** Which of what-you-did facts says the most: your own track first, then its artist. */
const DID_ORDER: readonly Fact["kind"][] = [
  "missed",
  "again",
  "finished",
  "artist",
  "stranger",
  "rules",
];

/** What you did, said about the track itself: worth more than a plain «из твоих лайков». */
const TELLING: ReadonlySet<Fact["kind"]> = new Set(["missed", "again", "finished", "artist"]);

const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * The line's parts, most telling first: where it came from, then what you did
 * with it (or with its artist) — or the other way round when where it came
 * from says little («из твоих лайков») and what you did says more, so a narrow
 * line keeps the part about you. At most two; empty when nothing is known.
 */
export function whyParts(facts: readonly Fact[], now: number): string[] {
  let from: string | null = null;
  let fromFact: Fact | null = null;
  for (const fact of facts) {
    from = whereFrom(fact, now);
    if (from) {
      fromFact = fact;
      break;
    }
  }
  let did: string | null = null;
  let didFact: Fact | null = null;
  for (const kind of DID_ORDER) {
    const fact = facts.find((f) => f.kind === kind);
    if (fact) {
      did = whatYouDid(fact, now);
      didFact = fact;
      break;
    }
  }
  // «Похож на … — ты дослушал его вчера» already says it was heard out.
  if (did === "ты дослушал его" && from?.includes("дослушал")) did = null;
  const plain =
    fromFact !== null &&
    (fromFact.kind === "liked" || (fromFact.kind === "history" && fromFact.at === null));
  if (from && did && didFact && plain && TELLING.has(didFact.kind)) {
    // An artist's name keeps its own case.
    return [didFact.kind === "artist" ? did : upper(did), lower(from)];
  }
  return [from, did].filter((part): part is string => part !== null);
}

/** The whole line: «Похож на «…» — ты дослушал его вчера · новый для тебя артист». */
export function whyLine(facts: readonly Fact[], now: number): string {
  return whyParts(facts, now).join(" · ");
}
