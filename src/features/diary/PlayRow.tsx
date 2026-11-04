import { AudioLines, Heart, Pause, Play as PlayIcon, Repeat, X } from "lucide-react";
import type { Play } from "@/api/types";
import { clockOf, type Ending, endingOf, sourceWords } from "@/features/diary/days";
import { useOpener } from "@/features/library/nav";
import { usePlayer } from "@/features/player/store";
import { Artwork } from "@/ui/Artwork";

const round =
  "pointer-events-auto grid size-8 place-content-center rounded-full text-fg-muted transition-colors duration-150 hover:bg-white/[0.08] hover:text-fg";

/** How far it got, as a short bar, and how it ended, in words. */
function EndingCell({ ending, liked }: { ending: Ending; liked: boolean }) {
  const share = Math.max(0.04, Math.min(1, ending.share));
  return (
    <span
      className={`grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-center gap-2.5 font-bold text-[12.5px] tabular-nums ${
        ending.tone === "done"
          ? "text-fg"
          : ending.tone === "live"
            ? "text-glow-1"
            : "text-fg-muted"
      }`}
    >
      <span aria-hidden="true" className="relative h-1 overflow-hidden rounded-sm bg-white/[0.12]">
        <i
          style={{ width: `${(share * 100).toFixed(1)}%` }}
          className={`absolute inset-y-0 left-0 rounded-sm ${
            ending.tone === "left" ? "bg-white/[0.42]" : "bg-linear-to-r from-glow-1 to-glow-2"
          }`}
        />
      </span>
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate">{ending.text}</span>
        {ending.again && <Repeat className="size-[13px] shrink-0" aria-label="и включил ещё раз" />}
        {liked && (
          <Heart className="size-[13px] shrink-0 fill-glow-1 text-glow-1" aria-label="лайкнул" />
        )}
      </span>
    </span>
  );
}

/** The ending of the play sounding now reads its place from the player, four times a second. */
function LiveEnding({ play }: { play: Play }) {
  const position = usePlayer((s) => s.position);
  const playing = usePlayer((s) => s.playing);
  return <EndingCell ending={endingOf(play, { position, playing })} liked={play.liked} />;
}

/**
 * One play: when, the track, where it came from, how it ended. Pressing the
 * row plays its part of the day from here; the one sounding now pauses.
 */
export function PlayRow({
  play,
  now,
  onPlay,
  onForget,
}: {
  play: Play;
  /** It is the play sounding (or paused) in the player right now. */
  now: boolean;
  onPlay: () => void;
  onForget: () => void;
}) {
  const open = useOpener();
  const playing = usePlayer((s) => s.playing);
  const artist = play.track.user;
  const left = play.outcome === "skipped" || play.outcome === "rejected";
  const source = sourceWords(play.source);
  const sounding = now && playing;

  return (
    <div
      className={`group/row relative grid h-14 grid-cols-[46px_44px_minmax(0,1fr)_176px_32px] items-center gap-3 rounded-xl px-2.5 transition-colors duration-150 focus-within:bg-white/[0.04] hover:bg-white/[0.04] @4xl:grid-cols-[46px_44px_minmax(0,1fr)_minmax(0,0.62fr)_184px_32px]`}
    >
      {/* The whole row plays; the artist and × sit above this one. */}
      <button
        type="button"
        onClick={onPlay}
        aria-label={`${sounding ? "Пауза" : now ? "Играть" : "Слушать отсюда"}: ${play.track.title}`}
        className="absolute inset-0 rounded-xl"
      />
      <span className="pointer-events-none relative text-right font-bold text-[12.5px] text-fg-faint tabular-nums">
        {clockOf(play)}
      </span>
      <span
        className={`pointer-events-none relative size-11 transition-opacity group-hover/row:opacity-100 ${left ? "opacity-[0.62]" : ""}`}
      >
        <Artwork url={play.track.artworkUrl} size={100} className="size-11 rounded-[9px]" />
        <span
          aria-hidden="true"
          className={`absolute inset-0 grid place-content-center rounded-[9px] transition-opacity duration-150 group-focus-within/row:opacity-100 group-hover/row:opacity-100 ${now ? "bg-black/55 text-glow-1 opacity-100" : "bg-black/45 text-white opacity-0"}`}
        >
          {sounding ? (
            <>
              <AudioLines className="size-[18px] group-hover/row:hidden" />
              <Pause className="hidden size-[18px] fill-current stroke-none group-hover/row:block" />
            </>
          ) : (
            <PlayIcon className="size-[18px] translate-x-px fill-current stroke-none" />
          )}
        </span>
      </span>
      <span
        className={`pointer-events-none relative min-w-0 transition-opacity group-hover/row:opacity-100 ${left ? "opacity-[0.62]" : ""}`}
      >
        <b
          title={play.track.title}
          className={`block truncate font-extrabold text-[14.5px] leading-tight ${now ? "text-glow-1" : ""}`}
        >
          {play.track.title}
        </b>
        {artist && (
          <button
            type="button"
            onClick={() => open.artist(artist)}
            className="pointer-events-auto mt-0.5 block max-w-full truncate rounded text-left font-semibold text-[13px] text-fg-muted transition-colors hover:text-fg"
          >
            {artist.username}
          </button>
        )}
      </span>
      <span className="pointer-events-none relative hidden min-w-0 truncate font-bold text-[12.5px] text-fg-faint @4xl:block">
        {source}
        {play.added && (
          <>
            {source ? " · " : ""}
            <span className="text-glow-1">ты добавил</span>
          </>
        )}
      </span>
      <span className="pointer-events-none relative min-w-0">
        {play.outcome === null && now ? (
          <LiveEnding play={play} />
        ) : (
          <EndingCell ending={endingOf(play)} liked={play.liked} />
        )}
      </span>
      <button
        type="button"
        onClick={onForget}
        aria-label={`Убрать из дневника: ${play.track.title}`}
        title="Убрать из дневника"
        className={`${round} relative opacity-0 focus-visible:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100`}
      >
        <X className="size-[17px]" aria-hidden="true" />
      </button>
    </div>
  );
}
