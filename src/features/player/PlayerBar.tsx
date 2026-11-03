import {
  Heart,
  ListMusic,
  LoaderCircle,
  MicVocal,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect } from "react";
import { useLikes } from "@/features/library/queries";
import { currentTrack, type QueueSource, usePlayer } from "@/features/player/store";
import { useLoudness } from "@/features/player/useLoudness";
import { VolumeSlider } from "@/features/player/VolumeSlider";
import { WaveformSeek } from "@/features/player/WaveformSeek";
import { Artwork } from "@/ui/Artwork";
import { formatSeconds } from "@/ui/format";

function from(source: QueueSource | null): string {
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
    default:
      return "";
  }
}

const iconButton =
  "grid size-8 place-content-center rounded-full text-fg-muted transition-colors duration-150 hover:text-fg disabled:cursor-default disabled:opacity-40 disabled:hover:text-fg-muted";

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
  const hasNext = usePlayer((s) => s.index + 1 < s.queue.length || Boolean(s.options.refill));
  const { toggle, next, previous, seek, setVolume, toggleMute, say } = usePlayer.getState();
  const loudness = useLoudness(track);
  const likes = useLikes();
  const liked = track !== null && Boolean(likes.data?.items.some((i) => i.track.id === track.id));

  // A notice is news, not a state: it steps aside after a while.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => say(null), 7000);
    return () => clearTimeout(timer);
  }, [notice, say]);

  const shownVolume = muted ? 0 : volume;
  const VolumeIcon = shownVolume === 0 ? VolumeX : shownVolume < 0.5 ? Volume1 : Volume2;
  const fromLabel = from(source);

  return (
    <footer className="relative z-30 grid h-[84px] shrink-0 grid-cols-[clamp(180px,24vw,320px)_minmax(0,1fr)_auto] items-center gap-[clamp(16px,2.2vw,30px)] border-line border-t bg-dock pr-7 pl-[18px]">
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
          <span
            role="status"
            className={`flex min-w-0 font-bold text-[13px] ${notice ? "text-fg" : "text-fg-muted"}`}
          >
            {notice ? (
              <>
                <span className="truncate">{notice}</span>
                {noticeAction && (
                  <button
                    type="button"
                    onClick={() => {
                      noticeAction.run();
                      say(null);
                    }}
                    className="ml-2 shrink-0 font-extrabold text-glow-1 underline-offset-2 hover:underline"
                  >
                    {noticeAction.label}
                  </button>
                )}
              </>
            ) : track ? (
              <>
                <span className="truncate">{track.user?.username}</span>
                {fromLabel && (
                  <span className="max-w-[65%] shrink-0 truncate whitespace-pre">
                    {track.user ? " · " : ""}
                    {fromLabel}
                  </span>
                )}
              </>
            ) : (
              <span className="truncate">Включи подборку или трек из лайков</span>
            )}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[22px]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={previous}
            disabled={!track}
            aria-label="Назад"
            title="Назад"
            className={iconButton}
          >
            <SkipBack className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={!track}
            aria-label={playing ? "Пауза" : "Играть"}
            className="grid size-11 place-content-center rounded-full bg-white text-ink transition-transform duration-150 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
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
            disabled={!track || !hasNext}
            aria-label="Дальше"
            title="Дальше"
            className={iconButton}
          >
            <SkipForward className="size-5" aria-hidden="true" />
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

      <div className="flex items-center justify-end gap-2.5">
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
          className={iconButton}
        >
          <MicVocal className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled
          aria-label="Очередь — скоро"
          title="Очередь — скоро"
          className={iconButton}
        >
          <ListMusic className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Включить звук" : "Выключить звук"}
          title={muted ? "Включить звук" : "Выключить звук"}
          className={iconButton}
        >
          <VolumeIcon className="size-5" aria-hidden="true" />
        </button>
        <VolumeSlider value={shownVolume} onChange={setVolume} />
      </div>
    </footer>
  );
}
