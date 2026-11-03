import { useVirtualizer } from "@tanstack/react-virtual";
import { AudioLines } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Track } from "@/api/types";
import { useScrollRoot } from "@/app/scrollRoot";
import { usePointedCover } from "@/features/library/light";
import { currentTrack, usePlayer } from "@/features/player/store";
import { canPlay } from "@/features/selection/buildQueue";
import { Artwork } from "@/ui/Artwork";
import { stateBadge } from "@/ui/trackState";

const GAP = 10;
/** Narrowest cover on the wall, and while searching (when names show under them). */
const MIN_TILE = 104;
const MIN_TILE_NAMED = 150;
const NAMES = 46;

interface CoverWallProps {
  tracks: readonly Track[];
  /** Names the wall for screen readers: «Лайки». */
  label: string;
  onPlay: (track: Track) => void;
  /** Titles under the covers. While searching the names matter more than the pictures. */
  named: boolean;
}

/**
 * Tracks as a wall of their covers. Only the rows near the screen exist, so a
 * library of thousands scrolls as lightly as a page of twenty. Pointing at a
 * cover shows its name and lends its colours to the light at the top.
 */
export function CoverWall({ tracks, label, onPlay, named }: CoverWallProps) {
  const scroller = useScrollRoot();
  const wall = useRef<HTMLUListElement>(null);
  const [width, setWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  const nowId = usePlayer((s) => currentTrack(s)?.id ?? null);
  const playing = usePlayer((s) => s.playing);
  const point = usePointedCover((s) => s.point);
  const pause = useRef(0);

  // The wall's width sets its columns; where it starts sets the windowing.
  useLayoutEffect(() => {
    const node = wall.current;
    const above = node?.parentElement;
    if (!node || !above || !scroller) return;
    const measure = () => {
      setWidth(node.clientWidth);
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

  const min = named ? MIN_TILE_NAMED : MIN_TILE;
  const gapY = named ? 18 : GAP;
  const columns = Math.max(1, Math.floor((width + GAP) / (min + GAP)));
  const tile = width > 0 ? (width - GAP * (columns - 1)) / columns : min;
  const rowHeight = tile + (named ? NAMES : 0) + gapY;

  const rows = useVirtualizer({
    count: Math.ceil(tracks.length / columns),
    getScrollElement: () => scroller,
    estimateSize: () => rowHeight,
    overscan: 3,
    scrollMargin: offset,
  });
  // Every row is the same height; when that changes (a resize, names on or off), re-lay them all.
  useEffect(() => {
    if (rowHeight > 0) rows.measure();
  }, [rowHeight, rows]);

  // A brief rest before the light follows, so sweeping across the wall does not flicker it.
  const pointAt = (cover: string | null) => {
    window.clearTimeout(pause.current);
    pause.current = window.setTimeout(() => point(cover), cover ? 70 : 0);
  };
  // A wall that goes away takes its pointing with it.
  useEffect(
    () => () => {
      window.clearTimeout(pause.current);
      point(null);
    },
    [point],
  );

  return (
    <ul
      ref={wall}
      aria-label={label}
      onMouseLeave={() => pointAt(null)}
      className="relative"
      style={{ height: Math.max(0, rows.getTotalSize() - gapY) }}
    >
      {rows.getVirtualItems().flatMap((row) =>
        tracks.slice(row.index * columns, row.index * columns + columns).map((track, column) => {
          const index = row.index * columns + column;
          const isNow = track.id === nowId;
          return (
            <li
              key={`${track.id}:${index}`}
              aria-posinset={index + 1}
              aria-setsize={tracks.length}
              className="absolute top-0 left-0 hover:z-10 focus-within:z-10"
              style={{
                width: tile,
                transform: `translate(${column * (tile + GAP)}px, ${row.start - offset}px)`,
              }}
            >
              <Cover
                track={track}
                named={named}
                isNow={isNow}
                playing={isNow && playing}
                onPoint={() => pointAt(track.artworkUrl)}
                onPlay={() => (isNow ? usePlayer.getState().toggle() : onPlay(track))}
              />
            </li>
          );
        }),
      )}
    </ul>
  );
}

function Cover({
  track,
  named,
  isNow,
  playing,
  onPoint,
  onPlay,
}: {
  track: Track;
  named: boolean;
  isNow: boolean;
  playing: boolean;
  onPoint: () => void;
  onPlay: () => void;
}) {
  const badge = stateBadge(track);
  const off = !canPlay(track);
  const name = (
    <>
      <b className="block truncate font-extrabold">{track.title}</b>
      <span className="block truncate font-bold opacity-75">{track.user?.username}</span>
    </>
  );
  return (
    <button
      type="button"
      disabled={off}
      onClick={onPlay}
      onMouseEnter={onPoint}
      onFocus={onPoint}
      aria-label={`${track.title} — ${track.user?.username ?? ""}${badge ? `, ${badge}` : ""}`}
      aria-current={isNow ? "true" : undefined}
      className="group block w-full text-left"
    >
      <span
        className={`relative block aspect-square overflow-hidden rounded-xl bg-panel-hover transition-[transform,box-shadow] duration-200 ease-out group-hover:scale-[1.06] group-hover:shadow-[0_18px_40px_-14px_rgb(0_0_0/0.9)] group-focus-visible:scale-[1.06] group-disabled:group-hover:scale-100 ${isNow ? "shadow-[0_0_0_3px_var(--glow-1)] group-hover:shadow-[0_0_0_3px_var(--glow-1),0_18px_40px_-14px_rgb(0_0_0/0.9)]" : ""}`}
      >
        <Artwork
          url={track.artworkUrl}
          size={300}
          className={`size-full ${off ? "opacity-35" : ""}`}
        />
        {track.access.preview && !off && (
          <span className="absolute top-1.5 left-1.5 rounded-md bg-black/65 px-1.5 py-1 font-extrabold text-[10.5px] text-white/90 leading-none">
            Go+ · 30 с
          </span>
        )}
        {isNow && (
          <span className="absolute top-1.5 right-1.5 grid size-6 place-content-center rounded-full bg-black/60 text-glow-1">
            <AudioLines className={`size-3.5 ${playing ? "" : "opacity-60"}`} aria-hidden="true" />
          </span>
        )}
        {!named && (
          <span
            className={`absolute inset-x-0 bottom-0 bg-linear-to-b from-transparent to-black/85 px-2 pt-6 pb-1.5 text-[12px] text-white leading-tight transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${isNow ? "opacity-100" : "opacity-0"}`}
          >
            {name}
            {off && badge && (
              <span className="mt-0.5 block truncate font-extrabold text-[10.5px] text-white/80">
                {badge}
              </span>
            )}
          </span>
        )}
      </span>
      {named && (
        <span
          className={`block px-0.5 pt-2 text-[13.5px] leading-tight ${off ? "opacity-40" : ""} ${isNow ? "text-glow-1" : ""}`}
        >
          {name}
        </span>
      )}
    </button>
  );
}

/** Quiet squares in the wall's own rhythm while it loads. */
export function WallSkeleton({ count = 24 }: { count?: number }) {
  return (
    <ul
      aria-hidden="true"
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_TILE}px, 1fr))` }}
    >
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders with no identity
        <li key={i} className="aspect-square rounded-xl bg-panel" />
      ))}
    </ul>
  );
}
