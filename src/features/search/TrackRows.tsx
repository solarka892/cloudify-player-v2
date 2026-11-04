import { useVirtualizer } from "@tanstack/react-virtual";
import { Ellipsis, Heart, Pause, Play } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { Track } from "@/api/types";
import { useScrollRoot } from "@/app/scrollRoot";
import { leavesGroup, usePointing } from "@/features/library/light";
import { useLikedIds, useToggleLike } from "@/features/library/likes";
import { useOpener } from "@/features/library/nav";
import { TrackMenu } from "@/features/library/TrackMenu";
import { currentTrack, type QueueSource, usePlayer } from "@/features/player/store";
import { canPlay } from "@/features/selection/engine";
import { Artwork } from "@/ui/Artwork";
import { formatCount, formatDuration, shortDate } from "@/ui/format";
import { stateBadge } from "@/ui/trackState";

// Search shows tracks as rows: a found title is read before it is played, and
// re-uploads come with long, messy names that a caption under a cover cuts short.

const ROW = 56;

/** The extra columns of a wide row, shown as the list's width allows. */
const GENRE = "hidden w-[150px] shrink-0 truncate @3xl:block";
const PLAYS = "hidden w-[92px] shrink-0 text-right @xl:block";
const ADDED = "hidden w-[104px] shrink-0 text-right @2xl:block";

const round =
  "pointer-events-auto grid size-8 place-content-center rounded-full text-fg-muted transition-colors duration-150 hover:bg-white/[0.08] hover:text-fg";

interface RowProps {
  track: Track;
  isNow: boolean;
  playing: boolean;
  liked: boolean;
  source: QueueSource;
  /** With genre, plays and the day it was added, for a list of tracks in full. */
  wide?: boolean;
  onPlay: () => void;
  onPoint: () => void;
  onLike: () => void;
}

/** One found track: press anywhere to play; its artist, heart and «…» on the right. */
export function TrackRow({
  track,
  isNow,
  playing,
  liked,
  source,
  wide = false,
  onPlay,
  onPoint,
  onLike,
}: RowProps) {
  const open = useOpener();
  const more = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const badge = stateBadge(track);
  const off = !canPlay(track);
  const artist = track.user;
  const cell = "font-bold text-[12.5px] text-fg-faint tabular-nums";

  return (
    <div
      className={`group/row relative flex h-14 items-center gap-3 rounded-xl px-2.5 transition-colors duration-150 focus-within:bg-white/5 hover:bg-white/5 ${menu ? "bg-white/5" : ""}`}
    >
      {/* The whole row plays; the buttons on it sit above this one. */}
      <button
        type="button"
        disabled={off}
        onClick={onPlay}
        onMouseEnter={onPoint}
        onFocus={onPoint}
        aria-label={`${isNow && playing ? "Пауза" : "Слушать"}: ${track.title}${badge ? `, ${badge}` : ""}`}
        className="absolute inset-0 rounded-xl"
      />
      <span className="pointer-events-none relative size-11 shrink-0">
        <Artwork
          url={track.artworkUrl}
          size={100}
          className={`size-11 rounded-[9px] ${off ? "opacity-40" : ""}`}
        />
        {!off && (
          <span
            aria-hidden="true"
            className={`absolute inset-0 grid place-content-center rounded-[9px] bg-black/45 text-white transition-opacity duration-150 group-focus-within/row:opacity-100 group-hover/row:opacity-100 ${isNow ? "opacity-100" : "opacity-0"}`}
          >
            {isNow && playing ? (
              <Pause className="size-[18px] fill-current stroke-none" />
            ) : (
              <Play className="size-[18px] translate-x-px fill-current stroke-none" />
            )}
          </span>
        )}
      </span>
      <span className={`pointer-events-none relative min-w-0 flex-1 ${off ? "opacity-40" : ""}`}>
        <b
          title={track.title}
          className={`block truncate font-extrabold text-[14.5px] leading-tight ${isNow ? "text-glow-1" : ""}`}
        >
          {track.title}
        </b>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {badge && (
            <span className="shrink-0 whitespace-nowrap rounded-lg bg-white/[0.07] px-2 py-1 font-extrabold text-[11px] text-fg-muted leading-none">
              {badge}
            </span>
          )}
          {artist && (
            <button
              type="button"
              onClick={() => open.artist(artist)}
              className="pointer-events-auto min-w-0 truncate rounded text-left font-bold text-[13px] text-fg-muted transition-colors hover:text-fg"
            >
              {artist.username}
            </button>
          )}
        </span>
      </span>
      {wide && (
        <>
          <span className={`pointer-events-none relative ${GENRE} ${cell}`}>{track.genre}</span>
          <span className={`pointer-events-none relative ${PLAYS} ${cell}`}>
            {track.playbackCount != null ? formatCount(track.playbackCount) : ""}
          </span>
          <span className={`pointer-events-none relative ${ADDED} ${cell}`}>
            {track.createdAt ? shortDate(track.createdAt) : ""}
          </span>
        </>
      )}
      <span className="relative flex shrink-0 items-center gap-0.5">
        <span
          className={`flex gap-0.5 transition-opacity duration-150 group-focus-within/row:opacity-100 group-hover/row:opacity-100 ${menu || liked ? "opacity-100" : "opacity-0"}`}
        >
          <button
            type="button"
            onClick={onLike}
            aria-pressed={liked}
            aria-label={liked ? `Убрать из лайков: ${track.title}` : `В лайки: ${track.title}`}
            title={liked ? "Убрать из лайков" : "В лайки"}
            className={round}
          >
            <Heart
              className={`size-[18px] ${liked ? "fill-glow-1 text-glow-1" : ""}`}
              aria-hidden="true"
            />
          </button>
          <button
            ref={more}
            type="button"
            onClick={() => setMenu((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={`Ещё: ${track.title}`}
            title="Ещё"
            className={round}
          >
            <Ellipsis className="size-[18px]" aria-hidden="true" />
          </button>
        </span>
        <span className={`pointer-events-none w-11 text-right ${cell}`}>
          {formatDuration(track.fullDurationMs)}
        </span>
      </span>
      {menu && more.current && (
        <TrackMenu
          track={track}
          anchor={more.current}
          source={source}
          onClose={() => setMenu(false)}
        />
      )}
    </div>
  );
}

/** What every row of a list shares: what plays, the hearts, the pointed light. */
function useRows() {
  const nowId = usePlayer((s) => currentTrack(s)?.id ?? null);
  const playing = usePlayer((s) => s.playing);
  const pointAt = usePointing();
  const likedIds = useLikedIds();
  const toggleLike = useToggleLike();
  return { nowId, playing, pointAt, likedIds, toggleLike };
}

interface ListProps {
  tracks: readonly Track[];
  /** Names the list for screen readers: «Треки». */
  label: string;
  source: QueueSource;
  onPlay: (track: Track) => void;
}

/** The best few as two columns of rows, read down the first column, then the second. */
export function TrackRowColumns({ tracks, label, source, onPlay }: ListProps) {
  const { nowId, playing, pointAt, likedIds, toggleLike } = useRows();
  const perColumn = Math.ceil(tracks.length / 2);
  return (
    <ul
      aria-label={label}
      onMouseLeave={() => pointAt(null)}
      onBlur={(event) => leavesGroup(event) && pointAt(null)}
      className="-mx-2.5 grid grid-flow-col grid-cols-2 gap-x-8"
      style={{ gridTemplateRows: `repeat(${perColumn}, ${ROW}px)` }}
    >
      {tracks.map((track) => {
        const isNow = track.id === nowId;
        const liked = likedIds.has(track.id);
        return (
          <li key={track.id} className="min-w-0">
            <TrackRow
              track={track}
              isNow={isNow}
              playing={isNow && playing}
              liked={liked}
              source={source}
              onPoint={() => pointAt(track.artworkUrl)}
              onLike={() => toggleLike(track, liked)}
              onPlay={() => (isNow ? usePlayer.getState().toggle() : onPlay(track))}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** The heads over a wide list's columns. */
export function TrackListHead() {
  const head = "font-bold text-[12.5px] text-fg-faint";
  return (
    <div
      aria-hidden="true"
      className="-mx-2.5 mb-1.5 flex items-center gap-3 border-line border-b px-2.5 pb-2"
    >
      <span className={`ml-14 min-w-0 flex-1 ${head}`}>Трек</span>
      <span className={`${GENRE} ${head}`}>Жанр</span>
      <span className={`${PLAYS} ${head}`}>Слушали</span>
      <span className={`${ADDED} ${head}`}>Добавлен</span>
      <span className={`w-[110px] text-right ${head}`}>Длина</span>
    </div>
  );
}

/**
 * Every track found, as wide rows. Only the rows near the screen exist, so a
 * search paged two thousand tracks deep scrolls as lightly as its first page.
 */
export function TrackRowList({ tracks, label, source, onPlay }: ListProps) {
  const scroller = useScrollRoot();
  const list = useRef<HTMLUListElement>(null);
  const [offset, setOffset] = useState(0);
  const { nowId, playing, pointAt, likedIds, toggleLike } = useRows();

  // Where the list starts in the page sets the windowing.
  useLayoutEffect(() => {
    const node = list.current;
    const above = node?.parentElement;
    if (!node || !above || !scroller) return;
    const measure = () => {
      const top =
        node.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      setOffset((old) => (Math.abs(old - top) < 1 ? old : top));
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(above);
    return () => resize.disconnect();
  }, [scroller]);

  const rows = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => scroller,
    estimateSize: () => ROW,
    overscan: 8,
    scrollMargin: offset,
    // Mounting under a scrolled page must not jump it back to the top.
    initialOffset: () => scroller?.scrollTop ?? 0,
  });

  return (
    <ul
      ref={list}
      aria-label={label}
      onMouseLeave={() => pointAt(null)}
      onBlur={(event) => leavesGroup(event) && pointAt(null)}
      className="relative -mx-2.5"
      style={{ height: rows.getTotalSize() }}
    >
      {rows.getVirtualItems().map((row) => {
        const track = tracks[row.index];
        if (!track) return null;
        const isNow = track.id === nowId;
        const liked = likedIds.has(track.id);
        return (
          <li
            key={track.id}
            aria-posinset={row.index + 1}
            aria-setsize={tracks.length}
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${row.start - offset}px)` }}
          >
            <TrackRow
              track={track}
              isNow={isNow}
              playing={isNow && playing}
              liked={liked}
              source={source}
              wide
              onPoint={() => pointAt(track.artworkUrl)}
              onLike={() => toggleLike(track, liked)}
              onPlay={() => (isNow ? usePlayer.getState().toggle() : onPlay(track))}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** Quiet rows while a list loads. */
export function RowsSkeleton({ count = 8, columns = 1 }: { count?: number; columns?: 1 | 2 }) {
  return (
    <ul
      aria-hidden="true"
      className={`-mx-2.5 grid gap-x-8 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}
    >
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders with no identity
        <li key={i} className="flex h-14 items-center gap-3 px-2.5">
          <span className="size-11 shrink-0 rounded-[9px] bg-panel" />
          <span className="flex-1">
            <span className="block h-3 w-2/5 rounded bg-panel" />
            <span className="mt-2 block h-2.5 w-1/4 rounded bg-panel/70" />
          </span>
        </li>
      ))}
    </ul>
  );
}
