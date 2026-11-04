import {
  Heart,
  ListMusic,
  LoaderCircle,
  MicVocal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect } from "react";
import { useOpener } from "@/features/library/nav";
import { useLikes } from "@/features/library/queries";
import { usePanels } from "@/features/player/panels";
import { from } from "@/features/player/source";
import { currentTrack, hasNext, usePlayer } from "@/features/player/store";
import { useLoudness } from "@/features/player/useLoudness";
import { VolumeSlider } from "@/features/player/VolumeSlider";
import { WaveformSeek } from "@/features/player/WaveformSeek";
import { moreLikeThis, notThis, useSelectionSession } from "@/features/selection/session";
import { usePickOf } from "@/features/selection/useSelection";
import { whyLine } from "@/features/selection/why";
import { Artwork } from "@/ui/Artwork";
import { formatSeconds } from "@/ui/format";

const iconButton =
  "relative grid size-8 place-content-center rounded-full text-fg-muted transition-colors duration-150 hover:text-fg disabled:cursor-default disabled:opacity-40 disabled:hover:text-fg-muted";
/** A mode that is on takes the cover's colour and a dot under it. */
const modeOn =
  "text-glow-1 hover:text-glow-1 after:absolute after:-bottom-px after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-glow-1";

const REPEAT_NAMES = {
  off: "Повтор выключен",
  all: "Повтор очереди",
  one: "Повтор трека",
} as const;

/** The bar at the bottom: what plays, its real waveform, and the controls. */
export function PlayerBar() {
  const track = usePlayer(currentTrack);
  const source = usePlayer((s) => s.source);
  const playing = usePlayer((s) => s.playing);
  const buffering = usePlayer((s) => s.buffering);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const notice = usePlayer((s) => s.notice);
  const noticeAction = usePlayer((s) => s.noticeAction);
  const canNext = usePlayer(hasNext);
  const shuffled = usePlayer((s) => s.original !== null);
  const repeat = usePlayer((s) => s.repeat);
  const endless = usePlayer((s) => Boolean(s.options.refill));
  const queueOpen = usePanels((s) => s.queue);
  const deskOpen = usePanels((s) => s.desk);
  const fromSelection = source?.kind === "selection";
  const pick = usePickOf(fromSelection ? (track?.id ?? null) : null);
  // «Больше такого» already pressed on this track: the round stays lit, like a mode that is on.
  const asked = useSelectionSession((s) =>
    track ? s.steers.some((press) => press.kind === "more" && press.track.id === track.id) : false,
  );
  const { toggle, next, previous, seek, setVolume, toggleMute, toggleShuffle, cycleRepeat, say } =
    usePlayer.getState();
  const loudness = useLoudness(track);
  const likes = useLikes();
  const open = useOpener();
  const liked = track !== null && Boolean(likes.data?.items.some((i) => i.track.id === track.id));

  // A notice is news, not a state: it steps aside after a while.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => say(null), 7000);
    return () => clearTimeout(timer);
  }, [notice, say]);

  const shownVolume = muted ? 0 : volume;
  const VolumeIcon = shownVolume === 0 ? VolumeX : shownVolume < 0.5 ? Volume1 : Volume2;
  // While the selection plays, the line under the title says why this track, not just where from.
  // While the selection plays, a third line says why this track; where it came from is in it.
  const why = pick ? whyLine(pick.facts, Date.now()) : "";
  const fromLabel = why ? "" : from(source);
  const shuffleName = endless
    ? "Подборка и так вперемешку"
    : shuffled
      ? "Вернуть порядок (S)"
      : "Перемешать (S)";
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;

  return (
    <footer
      data-player-bar
      className="relative z-30 grid h-[84px] shrink-0 grid-cols-[clamp(180px,24vw,320px)_minmax(0,1fr)_auto] items-center gap-[clamp(16px,2.2vw,30px)] border-line border-t bg-dock pr-7 pl-[18px] max-[1100px]:grid-cols-[180px_minmax(0,1fr)_auto]"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <Artwork
          url={track?.artworkUrl ?? null}
          size={100}
          className="size-14 shrink-0 rounded-xl"
        />
        <div className="min-w-0">
          <b className="block truncate font-extrabold text-[15px]">
            {track ? track.title : "Ничего не играет"}
          </b>
          {/* In a narrow window a notice keeps its words: its «Вернуть» moves to the line below. */}
          <span
            role="status"
            className={`flex min-w-0 font-bold text-[13px] max-[1100px]:flex-wrap ${notice ? "text-fg" : "text-fg-muted"}`}
          >
            {notice ? (
              <>
                <span className="truncate max-[1100px]:basis-full" title={notice}>
                  {notice}
                </span>
                {noticeAction && (
                  <button
                    type="button"
                    onClick={() => {
                      noticeAction.run();
                      say(null);
                    }}
                    className="ml-2 shrink-0 font-extrabold text-glow-1 underline-offset-2 hover:underline max-[1100px]:ml-0"
                  >
                    {noticeAction.label}
                  </button>
                )}
              </>
            ) : track ? (
              <>
                {track.user && (
                  <button
                    type="button"
                    onClick={() => track.user && open.artist(track.user)}
                    className="max-w-full shrink-0 truncate rounded text-left transition-colors duration-150 hover:text-fg"
                  >
                    {track.user.username}
                  </button>
                )}
                {/* The artist keeps its room; where the queue came from gives way first. */}
                {fromLabel && (
                  <span className="min-w-0 truncate whitespace-pre">
                    {track.user ? " · " : ""}
                    {fromLabel}
                  </span>
                )}
              </>
            ) : (
              <span className="truncate">Включи подборку или трек из лайков</span>
            )}
          </span>
          {track && why && !notice && (
            <span
              title={why}
              className="block truncate font-bold text-[12.5px] text-fg-faint leading-tight"
            >
              {why}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[22px]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleShuffle}
            disabled={!track || endless}
            aria-pressed={shuffled}
            aria-label={shuffleName}
            title={shuffleName}
            className={`${iconButton} ${shuffled ? modeOn : ""} ${endless ? "max-[1100px]:hidden" : ""}`}
          >
            <Shuffle className="size-[18px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={previous}
            disabled={!track}
            aria-label="Назад"
            title="Назад (Shift+←)"
            className={iconButton}
          >
            <SkipBack className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={!track}
            aria-label={playing ? "Пауза" : "Играть"}
            title={`${playing ? "Пауза" : "Играть"} (пробел)`}
            className="mx-0.5 grid size-11 place-content-center rounded-full bg-white text-ink transition-transform duration-150 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            {playing && buffering ? (
              <LoaderCircle className="size-[19px] motion-safe:animate-spin" aria-hidden="true" />
            ) : playing ? (
              <Pause className="size-[19px] fill-current stroke-none" aria-hidden="true" />
            ) : (
              <Play
                className="size-[19px] translate-x-px fill-current stroke-none"
                aria-hidden="true"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => next("skip")}
            disabled={!track || !canNext}
            aria-label="Дальше"
            title="Дальше (Shift+→)"
            className={iconButton}
          >
            <SkipForward className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={cycleRepeat}
            disabled={!track}
            aria-label={REPEAT_NAMES[repeat]}
            title={`${REPEAT_NAMES[repeat]} (R)`}
            className={`${iconButton} ${repeat !== "off" ? modeOn : ""}`}
          >
            <RepeatIcon className="size-[18px]" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 font-bold text-[12.5px] text-fg-faint tabular-nums">
          <span className="min-w-[30px] text-right">{formatSeconds(position)}</span>
          <WaveformSeek
            loudness={loudness}
            position={position}
            duration={duration}
            onSeek={seek}
            disabled={!track}
          />
          <span className="min-w-[30px]">{formatSeconds(duration)}</span>
        </div>
      </div>

      {/* In a narrow window the waveform keeps its room: the gaps tighten, and the lyrics
          button that does not work yet steps out while the selection's presses are here. */}
      <div className="flex items-center justify-end gap-2.5 max-[1100px]:gap-1.5">
        {fromSelection && track && (
          <>
            <button
              type="button"
              onClick={notThis}
              aria-label="Не то"
              title="Не то — больше не предлагать, и похожего меньше"
              className={iconButton}
            >
              <ThumbsDown className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={moreLikeThis}
              aria-label="Больше такого"
              aria-pressed={asked}
              title={asked ? "Уже ищу больше такого" : "Больше такого — похожее пойдёт раньше"}
              className={`${iconButton} ${asked ? modeOn : ""}`}
            >
              <ThumbsUp className="size-5" aria-hidden="true" />
            </button>
            <span
              aria-hidden="true"
              className="mx-0.5 h-5 w-px bg-white/[0.12] max-[1100px]:hidden"
            />
          </>
        )}
        <button
          type="button"
          disabled
          aria-label={liked ? "В твоих лайках" : "Лайк отсюда — скоро"}
          title={liked ? "В твоих лайках" : "Лайк отсюда — скоро"}
          className={`${iconButton} ${liked ? "disabled:opacity-100" : ""}`}
        >
          <Heart
            className={`size-5 ${liked ? "fill-glow-1 text-glow-1" : ""}`}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          disabled
          aria-label="Текст песни — скоро"
          title="Текст песни — скоро"
          className={`${iconButton} ${fromSelection ? "max-[1100px]:hidden" : ""}`}
        >
          <MicVocal className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          data-desk-toggle
          onClick={() => usePanels.getState().showDesk()}
          aria-expanded={deskOpen}
          aria-controls="selection-desk"
          aria-label="Настроить подборку"
          title="Настроить подборку"
          className={`${iconButton} ${deskOpen ? "bg-white/10 text-fg" : ""}`}
        >
          <SlidersHorizontal className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => usePanels.getState().showQueue()}
          aria-expanded={queueOpen}
          aria-controls="queue-sheet"
          aria-label="Очередь"
          title="Очередь (Q)"
          className={`${iconButton} ${queueOpen ? "bg-white/10 text-fg" : ""}`}
        >
          <ListMusic className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Включить звук" : "Выключить звук"}
          title={`${muted ? "Включить звук" : "Выключить звук"} (M)`}
          className={iconButton}
        >
          <VolumeIcon className="size-5" aria-hidden="true" />
        </button>
        <VolumeSlider value={shownVolume} onChange={setVolume} />
      </div>
    </footer>
  );
}
