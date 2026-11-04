import { Pause, Play, SkipForward, SlidersHorizontal, ThumbsDown } from "lucide-react";
import { ApiError } from "@/api/invoke";
import type { Me } from "@/api/types";
import { useOpener } from "@/features/library/nav";
import { usePanels } from "@/features/player/panels";
import { currentTrack, usePlayer } from "@/features/player/store";
import { useLoudness } from "@/features/player/useLoudness";
import { LEARNING_PLAYS } from "@/features/selection/engine";
import { LearnBadge } from "@/features/selection/LearnBadge";
import { MOODS, moodById } from "@/features/selection/moods";
import { type Learning, useSelection } from "@/features/selection/useSelection";
import { Artwork } from "@/ui/Artwork";
import { formatCount, plural } from "@/ui/format";
import { Ribbon } from "@/ui/Ribbon";

const roundButton =
  "grid size-[54px] shrink-0 place-content-center rounded-full bg-[rgb(10_10_12/0.62)] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] transition-colors duration-150 hover:bg-[rgb(40_40_46/0.72)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[rgb(10_10_12/0.62)]";

/** Why there is nothing to play yet; what exactly broke is in «Что не так». */
function selectionProblem(error: unknown): string {
  const { kind } = ApiError.from(error);
  if (kind === "network") return "Подборка соберётся, как только появится сеть.";
  if (kind === "unauthorized") return "Подборка соберётся, когда ты снова войдёшь.";
  return "Подборка не собралась: лайки не загрузились.";
}

/** «Как обычно» says honestly how the selection picks: by its rules, or by what it has learned. */
function usualLine(learning: Learning, plays: number): string {
  switch (learning) {
    case "rules":
      return "Пока по правилам: два лайка, потом трек со станции. Тебя ещё не выучил — учусь с каждым треком, который дослушаешь или пропустишь.";
    case "learning":
      return `Учусь на твоём дневнике: ${plays} из ${LEARNING_PLAYS} прослушиваний. Пока правила главнее того, что я выучил.`;
    case "learned":
      return `Подбираю по твоему дневнику — ${formatCount(plays)} ${plural(plays, ["прослушивание", "прослушивания", "прослушиваний"])}. Скипнутое сюда не вернётся.`;
    case "unreadable":
      return "Дневник сейчас не читается, поэтому по правилам: два лайка, потом трек со станции.";
  }
}

/** «Подборка»: the endless selection, its light, its moods, and the cover that plays. */
export function Hero({ me }: { me: Me }) {
  const selection = useSelection();
  const active = usePlayer((s) => s.source?.kind === "selection" && s.index >= 0);
  const playing = usePlayer((s) => s.playing);
  const nowPlaying = usePlayer(currentTrack);
  const mood = moodById(selection.mood);
  const shown = active ? nowPlaying : selection.preview;
  const open = useOpener();
  const loudness = useLoudness(nowPlaying ?? shown);
  const likes = me.user.likesCount;
  const deskOpen = usePanels((s) => s.desk);

  let line =
    selection.mood === "usual"
      ? usualLine(selection.learning, selection.plays)
      : mood.line(likes ? formatCount(likes) : null);
  if (selection.status === "error") line = selectionProblem(selection.error);
  else if (selection.status === "empty") {
    line =
      selection.mood === "usual" || selection.mood === "fav"
        ? "Пока не из чего собрать: поставь пару лайков на SoundCloud — и подборка появится."
        : active
          ? "Такого не нашлось среди твоих лайков и похожих треков — подборка играет как раньше."
          : "Не нашлось такого среди твоих лайков и похожих треков. Попробуй другое настроение.";
  }

  const ready = selection.status === "ready";
  const onListen = () => {
    if (active) usePlayer.getState().toggle();
    else selection.start();
  };
  const onSkip = () => {
    if (active) usePlayer.getState().next("skip");
    else selection.start(1);
  };
  const onDislike = () => {
    if (active) usePlayer.getState().next("dislike");
  };

  return (
    <section
      aria-labelledby="selection-title"
      className="grain relative isolate overflow-clip bg-ground"
    >
      <Ribbon
        playing={playing && nowPlaying !== null}
        energy={mood.light.energy}
        pace={mood.light.pace}
        loudness={loudness}
        className="absolute inset-x-0 top-10 h-[440px] w-full"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[120px] bg-linear-to-b from-transparent to-ground"
      />
      <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] gap-x-12 px-14 pt-[clamp(88px,13vh,112px)] pb-[42px]">
        <div className="@container min-w-0">
          <h1
            id="selection-title"
            className="whitespace-nowrap font-display font-extrabold text-[length:min(132px,15cqi)] leading-[0.92] tracking-[-0.055em] [text-shadow:0_10px_50px_rgb(0_0_0/0.35)]"
          >
            Подборка
          </h1>
          <p className="mt-[18px] min-h-[2.9em] max-w-[42ch] text-[17px] text-white/80 leading-[1.45] [text-shadow:0_2px_16px_rgb(0_0_0/0.4)]">
            {selection.status === "loading" ? "Собираю из твоих лайков и истории…" : line}
          </p>
          <div className="mt-[26px] flex items-center gap-3">
            <button
              type="button"
              onClick={onListen}
              disabled={!active && !ready}
              className="flex h-[54px] items-center gap-2.5 rounded-full bg-white pr-[26px] pl-5 font-extrabold text-[16px] text-ink transition-transform duration-150 ease-out hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {active && playing ? (
                <Pause className="size-5 fill-current stroke-none" aria-hidden="true" />
              ) : (
                <Play className="size-5 fill-current stroke-none" aria-hidden="true" />
              )}
              {active && playing ? "Пауза" : "Слушать подборку"}
            </button>
            <button
              type="button"
              onClick={onSkip}
              disabled={!active && (!ready || selection.queue.length < 2)}
              aria-label="Дальше"
              title="Дальше"
              className={roundButton}
            >
              <SkipForward className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onDislike}
              disabled={!active}
              aria-label="Не то — больше не предлагать"
              title="Не то — больше не предлагать, и похожего меньше"
              className={roundButton}
            >
              <ThumbsDown className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-desk-toggle
              onClick={() => usePanels.getState().showDesk()}
              aria-expanded={deskOpen}
              aria-controls="selection-desk"
              aria-label="Настроить подборку"
              title="Настроить подборку"
              className={`${roundButton} ${deskOpen ? "bg-[rgb(40_40_46/0.72)]" : ""}`}
            >
              <SlidersHorizontal className="size-5" aria-hidden="true" />
            </button>
          </div>
          <fieldset className="mt-[22px] flex flex-wrap items-center gap-2">
            <legend className="sr-only">Настроение подборки</legend>
            {MOODS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === selection.mood}
                onClick={() => selection.chooseMood(option.id)}
                className="h-9 rounded-full bg-[rgb(10_10_12/0.66)] px-[15px] font-bold text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] transition-colors duration-150 hover:text-white aria-pressed:bg-white aria-pressed:text-ink aria-pressed:shadow-none"
              >
                {option.label}
              </button>
            ))}
            <LearnBadge learning={selection.learning} plays={selection.plays} onLight />
          </fieldset>
        </div>
        <figure className="-mt-1 -mb-[30px] w-[clamp(220px,21vw,300px)] min-w-0">
          {shown ? (
            <Artwork
              url={shown.artworkUrl}
              size={500}
              eager
              className="aspect-square w-full rounded-[26px] shadow-[0_30px_60px_-24px_rgb(0_0_0/0.8)]"
            />
          ) : (
            <div className="aspect-square w-full rounded-[26px] bg-panel/70" />
          )}
          <figcaption className="mt-4 min-h-[44px]">
            {shown && (
              <>
                <b className="block truncate font-bold text-[19px] leading-tight">{shown.title}</b>
                {shown.user && (
                  <button
                    type="button"
                    onClick={() => shown.user && open.artist(shown.user)}
                    className="block max-w-full truncate font-bold text-fg-muted rounded text-left transition-colors duration-150 hover:text-fg"
                  >
                    {shown.user.username}
                  </button>
                )}
              </>
            )}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
