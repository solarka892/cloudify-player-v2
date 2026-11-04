import type { QueryKey } from "@tanstack/react-query";
import { ApiError } from "@/api/invoke";
import { describeError } from "@/ui/errors";

// What a problem says, in plain words: what broke, why, and what happens next.
// Russian verbs agree with what broke, so every part is named with its form:
// «Плейлисты не загрузились», «История не загрузилась», «Плейлист не загрузился».

/** A part of the interface, named so a sentence about it agrees with it. */
export interface Part {
  name: string;
  /** Many, or one feminine / masculine / neuter thing. */
  form: "pl" | "f" | "m" | "n";
}

type Forms = Record<Part["form"], string>;

const NOT_LOADED: Forms = {
  pl: "не загрузились",
  f: "не загрузилась",
  m: "не загрузился",
  n: "не загрузилось",
};
const NOT_IN_TIME: Forms = {
  pl: "не успели загрузиться",
  f: "не успела загрузиться",
  m: "не успел загрузиться",
  n: "не успело загрузиться",
};
const NOT_ALL: Forms = {
  pl: "загрузились не до конца",
  f: "загрузилась не до конца",
  m: "загрузился не до конца",
  n: "загрузилось не до конца",
};
const BROKE: Forms = { pl: "сломались", f: "сломалась", m: "сломался", n: "сломалось" };
const COMES_BY_ITSELF: Forms = {
  pl: "догрузятся сами",
  f: "догрузится сама",
  m: "догрузится сам",
  n: "догрузится само",
};

const said = (part: Part, forms: Forms) => `${part.name} ${forms[part.form]}`;
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export interface Words {
  title: string;
  /** Why, and what happens next. */
  text: string;
  /** A few words for the status button. */
  short: string;
}

export const EXPIRED: Words = {
  title: "Вход устарел",
  text: "SoundCloud больше не принимает твой вход. Так бывает, если выйти на сайте или сменить пароль. Войди снова: музыка, очередь и библиотека останутся на месте.",
  short: "Вход устарел",
};

/** Why SoundCloud did not answer as it should, as a sentence. */
function reason(error: ApiError): string {
  switch (error.kind) {
    case "network":
      return "Нет сети.";
    case "bot-filtered":
      return "SoundCloud не пустил: сработала его защита от ботов. С входом всё в порядке, попробуй чуть позже.";
    case "forbidden":
      return "SoundCloud не дал к этому доступа.";
    case "not-found":
      return "На SoundCloud этого больше нет: его удалили или скрыли.";
    case "not-available":
      return "SoundCloud не отдаёт это здесь: в твоём регионе или без защиты.";
    case "client-id":
      return "SoundCloud что-то поменял у себя, и подключиться не вышло. Обычно это быстро проходит.";
    case "decode":
      return "SoundCloud ответил что-то непонятное: похоже, он что-то поменял у себя.";
    case "api":
      return "SoundCloud ответил ошибкой у себя на сервере. Обычно это быстро проходит.";
    case "rate-limited":
      return "SoundCloud просит подождать: слишком много запросов подряд.";
    default:
      return describeError(error);
  }
}

/** A part SoundCloud did not give: all of it, or (`partial`) the rest of a long list. */
export function loadWords(part: Part, error: unknown, partial = false): Words {
  const failed = ApiError.from(error);
  if (failed.kind === "unauthorized" || failed.kind === "sign-in-required") return EXPIRED;
  if (failed.kind === "rate-limited") {
    const when = failed.retryAfterSecs ? ` через ${failed.retryAfterSecs} с` : " чуть позже";
    return {
      title: "SoundCloud просит подождать",
      text: `Слишком много запросов подряд. ${part.name} ${COMES_BY_ITSELF[part.form]}${when}.`,
      short: "SoundCloud просит подождать",
    };
  }
  if (failed.kind === "network") {
    const title = said(part, partial ? NOT_ALL : NOT_IN_TIME);
    return {
      title,
      text: `Нет сети. ${capital(COMES_BY_ITSELF[part.form])}, как только появится интернет.`,
      short: "Нет сети",
    };
  }
  const title = said(part, partial ? NOT_ALL : NOT_LOADED);
  return { title, text: reason(failed), short: title };
}

/** A part of the window that could not show itself: a bug in the app, not SoundCloud. */
export function crashWords(part: Part): Words {
  const title = said(part, BROKE);
  return {
    title,
    text: "Эта часть не смогла показаться, остальное работает. Перезапусти её, а если повторится, скопируй подробности для отчёта.",
    short: title,
  };
}

/** Something the person did that did not happen: `what` says it, `why` is added from the error. */
export function actionWords(title: string, what: string, error: unknown, short = title): Words {
  const failed = ApiError.from(error);
  if (failed.kind === "unauthorized" || failed.kind === "sign-in-required") return EXPIRED;
  return { title, text: `${what} ${reason(failed)}`, short };
}

/** A like or an unlike SoundCloud did not take. */
export function likeWords(trackTitle: string, liking: boolean, error: unknown): Words {
  const failed = ApiError.from(error);
  if (failed.kind === "bot-filtered") {
    return {
      title: liking ? "SoundCloud не пустил лайк" : "SoundCloud не дал снять лайк",
      text: `Сработала его защита от ботов, и сердечко у «${trackTitle}» ${liking ? "не поставилось" : "осталось"}. С входом всё в порядке: попробуй через минуту или сделай это на сайте.`,
      short: liking ? "Лайк не прошёл" : "Лайк не снялся",
    };
  }
  return liking
    ? actionWords("Лайк не прошёл", `Сердечко у «${trackTitle}» не поставилось.`, error)
    : actionWords("Лайк не снялся", `Сердечко у «${trackTitle}» осталось.`, error);
}

// --- which part a query is ----------------------------------------------------

/**
 * The part of the interface a query fills, by its key; `null` for queries
 * nobody should hear about (suggestions while typing, a track's waveform, the
 * session, which has screens of its own).
 */
export function partOf(key: QueryKey): Part | null {
  const [head, second, third] = key;
  if (head === "library") {
    switch (second) {
      case "likes":
        return { name: "Лайки", form: "pl" };
      case "history":
        return { name: "История", form: "f" };
      case "playlists":
        return { name: "Плейлисты", form: "pl" };
      case "albums":
        return { name: "Альбомы", form: "pl" };
      case "liked-playlists":
        return { name: "Лайкнутые плейлисты", form: "pl" };
      case "reposts":
        return { name: "Репосты", form: "pl" };
      case "followings":
        return { name: "Подписки", form: "pl" };
      default:
        return { name: "Библиотека", form: "f" };
    }
  }
  if (head === "playlist") return { name: "Плейлист", form: "m" };
  if (head === "artist") return { name: "Популярное артиста", form: "n" };
  // Without them the selection still plays from the likes; only the new finds are missing.
  if (head === "station" || head === "related")
    return { name: "Похожие треки для подборки", form: "pl" };
  // The selection's own reading of the diary: when it fails, the selection plays by its
  // rules and says so on its own; the diary's trouble is the diary's to tell.
  if (head === "selection") return null;
  if (head === "search") {
    if (second === "suggest" || second === "hits") return null;
    switch (third) {
      case "tracks":
        return { name: "Найденные треки", form: "pl" };
      case "users":
        return { name: "Найденные люди", form: "pl" };
      case "playlists":
        return { name: "Найденные плейлисты", form: "pl" };
      case "albums":
        return { name: "Найденные альбомы", form: "pl" };
      case "genres":
        return { name: "Жанры", form: "pl" };
      default:
        return { name: "Результаты поиска", form: "pl" };
    }
  }
  if (head === "diary") return { name: "Дневник", form: "m" };
  if (head === "session" || head === "waveform") return null;
  return { name: "Часть страницы", form: "f" };
}

// --- «Подробнее»: what SoundCloud answered ------------------------------------

/** What each Rust command asks SoundCloud for, in the words of «Что спрашивали». */
const ASKED: Record<string, string> = {
  session: "Кто вошёл",
  sign_in_with_window: "Вход через окно SoundCloud",
  sign_in_with_token: "Вход по ключу",
  my_likes: "Твои лайки",
  my_playlists: "Твои плейлисты",
  my_albums: "Твои альбомы",
  my_liked_playlists: "Лайкнутые плейлисты",
  my_reposts: "Твои репосты",
  my_followings: "Твои подписки",
  play_history: "История прослушиваний",
  playlist: "Плейлист целиком",
  artist_top_tracks: "Популярное артиста",
  like_track: "Лайк",
  unlike_track: "Снять лайк",
  search_all: "Поиск",
  search_tracks: "Поиск треков",
  search_track_genres: "Жанры найденных треков",
  search_users: "Поиск людей",
  search_playlists: "Поиск плейлистов",
  search_albums: "Поиск альбомов",
  search_suggestions: "Подсказки поиска",
  stream: "Звук трека",
  waveform: "Волна трека",
  track_station: "Радио по треку",
  artist_station: "Радио артиста",
  related_tracks: "Похожие треки",
  diary_start: "Записать прослушивание в дневник",
  diary_progress: "Записать, докуда дослушал",
  diary_end: "Записать, чем закончилось",
  diary_liked: "Записать лайк в дневник",
  diary_more: "Записать «больше такого» в дневник",
  diary_unreject: "Отменить «не то» в дневнике",
  diary_taste: "Что подборка знает из дневника",
  diary_plays: "Дневник",
  diary_settings: "Настройки дневника",
  diary_keep: "Сколько хранить дневник",
  diary_city: "Город для светового дня",
  diary_forget: "Убрать из дневника",
  diary_clear: "Стереть дневник",
};

const STATUS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

export interface Details {
  /** What SoundCloud answered: a status, or why there was no answer. */
  answer: string;
  /** What the app asked for, and the command that asked. */
  asked: string | null;
  /** The error's own message (and, for a crash, where it happened). */
  message: string;
}

export function detailsOf(error: ApiError, crash = false, stack?: string): Details {
  let answer: string;
  if (crash) answer = "SoundCloud ни при чём: ошибка в самом приложении";
  else if (error.status !== null) {
    const name = STATUS[error.status];
    answer = `${error.status}${name ? ` ${name}` : ""}${error.kind === "bot-filtered" ? " · защита от ботов DataDome" : ""}`;
  } else if (error.kind === "network") answer = "Не ответил: нет сети";
  else if (error.kind === "client-id") answer = "Не нашёлся ключ client_id на soundcloud.com";
  else if (error.kind === "decode") answer = "Ответ непонятного вида";
  else if (error.kind === "storage") answer = "SoundCloud ни при чём: файл на этом компьютере";
  else answer = "—";
  const asked = error.command ? `${ASKED[error.command] ?? "Запрос"} (${error.command})` : null;
  const where = stack
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join("\n");
  return { answer, asked, message: where ? `${error.message}\n${where}` : error.message };
}

/** A problem as plain text, for a bug report. */
export function reportOf(title: string, at: number, details: Details): string {
  return [
    `Cloudify: ${title}`,
    `Когда: ${new Date(at).toLocaleString("ru-RU")}`,
    `Ответ SoundCloud: ${details.answer}`,
    details.asked ? `Что спрашивали: ${details.asked}` : null,
    `Текст: ${details.message}`,
  ]
    .filter(Boolean)
    .join("\n");
}
