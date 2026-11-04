import type { QueueSource } from "@/features/player/store";

// How the player names where its queue came from.

/** Under the playing title in the bar: «из лайков», «радио · …». */
export function from(source: QueueSource | null): string {
  switch (source?.kind) {
    case "selection":
      return "из подборки";
    case "likes":
      return "из лайков";
    case "playlist":
      return `из «${source.title}»`;
    case "reposts":
      return "из репостов";
    case "artist":
      return `популярное · ${source.title}`;
    case "station":
      return `радио · ${source.title}`;
    case "search":
      return `из поиска «${source.title}»`;
    case "diary":
      return `из дневника · ${source.title}`;
    default:
      return "";
  }
}

/** The queue sheet's line about the whole queue: «Из лайков», «Подборка», «Радио · …». */
export function fromTitle(source: QueueSource | null): string {
  switch (source?.kind) {
    case "selection":
      return "Подборка";
    case "likes":
      return "Из лайков";
    case "playlist":
      return `Из «${source.title}»`;
    case "reposts":
      return "Из репостов";
    case "history":
      return "Из истории";
    case "resume":
      return "С прошлого раза";
    case "diary":
      return `Из дневника · ${source.title}`;
    case "artist":
      return `Популярное · ${source.title}`;
    case "station":
      return `Радио · ${source.title}`;
    case "search":
      return `Из поиска «${source.title}»`;
    default:
      return "";
  }
}

/** The name over the list's own tracks in the queue: «Дальше из лайков». */
export function aheadFrom(source: QueueSource | null): string {
  switch (source?.kind) {
    case "selection":
      return "Дальше в подборке";
    case "likes":
      return "Дальше из лайков";
    case "playlist":
      return `Дальше из «${source.title}»`;
    case "reposts":
      return "Дальше из репостов";
    case "history":
      return "Дальше из истории";
    case "artist":
      return `Дальше из популярного · ${source.title}`;
    case "station":
      return `Дальше по радио · ${source.title}`;
    case "search":
      return `Дальше из поиска «${source.title}»`;
    case "diary":
      return `Дальше из дневника · ${source.title}`;
    default:
      return "Дальше";
  }
}
