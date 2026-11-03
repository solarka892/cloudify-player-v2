import { ChevronRight } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import type { Track } from "@/api/types";
import { TrackTile } from "@/features/library/CoverWall";
import { leavesGroup, usePointing } from "@/features/library/light";
import { useLikedIds, useToggleLike } from "@/features/library/likes";
import { currentTrack, type QueueSource, usePlayer } from "@/features/player/store";

// «Всё» as shelves: each section shows exactly one row, as much as fits the
// window, and its title opens the whole section.

/** How many items at least `min` px wide fit side by side in the element. */
function useRowFit(min: number, gap: number) {
  const row = useRef<HTMLUListElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = row.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    return () => resize.disconnect();
  }, []);
  return { row, count: Math.max(1, Math.floor((width + gap) / (min + gap))) };
}

/** A shelf: its title is the way to the whole section. */
export function Shelf({
  id,
  title,
  count,
  onOpen,
  children,
}: {
  id: string;
  title: string;
  count: string | null;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mb-10">
      <h2 id={id} className="mb-[18px]">
        <button
          type="button"
          onClick={onOpen}
          className="group inline-flex items-center gap-2.5 rounded-lg pr-1"
        >
          <span className="font-bold font-display text-[19px] leading-none tracking-[-0.02em]">
            {title}
          </span>
          {count && (
            <span className="font-bold text-[14px] text-fg-faint tabular-nums leading-none">
              {count}
            </span>
          )}
          <ChevronRight
            className="-ml-1 size-5 text-fg-muted transition-[translate,color] duration-150 group-hover:translate-x-0.5 group-hover:text-fg"
            aria-hidden="true"
          />
        </button>
      </h2>
      {children}
    </section>
  );
}

/** One row of track tiles, as many as fit; pointing at one lends the light its colours. */
export function CoverRow({
  tracks,
  label,
  source,
  onPlay,
}: {
  tracks: readonly Track[];
  label: string;
  source: QueueSource;
  onPlay: (track: Track) => void;
}) {
  const { row, count } = useRowFit(168, 18);
  const nowId = usePlayer((s) => currentTrack(s)?.id ?? null);
  const playing = usePlayer((s) => s.playing);
  const pointAt = usePointing();
  const likedIds = useLikedIds();
  const toggleLike = useToggleLike();
  return (
    <ul
      ref={row}
      aria-label={label}
      onMouseLeave={() => pointAt(null)}
      onBlur={(event) => leavesGroup(event) && pointAt(null)}
      className="grid gap-[18px]"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {tracks.slice(0, count).map((track) => {
        const isNow = track.id === nowId;
        const liked = likedIds.has(track.id);
        return (
          <li key={track.id} className="relative min-w-0 focus-within:z-10 hover:z-10">
            <TrackTile
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

/** One row of tiles (playlists, people, stations), as many as fit. */
export function TileRow<T>({
  items,
  label,
  min = 168,
  render,
}: {
  items: readonly T[];
  label: string;
  min?: number;
  render: (item: T) => ReactNode;
}) {
  const { row, count } = useRowFit(min, 18);
  return (
    <ul
      ref={row}
      aria-label={label}
      className="grid gap-[18px]"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {items.slice(0, count).map(render)}
    </ul>
  );
}

/** A row-high quiet strip while a shelf loads. */
export function RowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid h-[232px] auto-rows-[232px] gap-[18px] overflow-hidden"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))" }}
    >
      {["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"].map((key) => (
        <span key={key} className="rounded-xl bg-panel" />
      ))}
    </div>
  );
}
