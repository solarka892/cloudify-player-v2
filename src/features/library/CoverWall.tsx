import { useVirtualizer } from "@tanstack/react-virtual";
import { AudioLines, Ellipsis, Heart, Pause, Play } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Track } from "@/api/types";
import { useScrollRoot } from "@/app/scrollRoot";
import { leavesGroup, usePointing } from "@/features/library/light";
import { useLikedIds, useToggleLike } from "@/features/library/likes";
import { useOpener } from "@/features/library/nav";
import { TrackMenu } from "@/features/library/TrackMenu";
import { currentTrack, type QueueSource, usePlayer } from "@/features/player/store";
import { canPlay } from "@/features/selection/engine";
import { Artwork } from "@/ui/Artwork";
import { stateBadge } from "@/ui/trackState";

/** Narrowest tile on a wall: six across a 1440 px window, like soundcloud.com's grid. */
const MIN_TILE = 196;
const GAP_X = 24;
const GAP_Y = 28;
/** Title and artist under each cover. */
const CAPTION = 48;

/** One track: its cover to play, its name and artist always shown, its actions on hover. */
export function TrackTile({
  track,
  isNow,
  playing,
  liked,
  source,
  onPlay,
  onPoint,
  onLike,
}: {
  track: Track;
  isNow: boolean;
  playing: boolean;
  liked: boolean;
  /** Where «Играть следующим» says the track came from when nothing plays. */
  source: QueueSource;
  onPlay: () => void;
  onPoint: () => void;
  onLike: () => void;
}) {
  const open = useOpener();
  const more = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const badge = stateBadge(track);
  const off = !canPlay(track);
  const artist = track.user;
  const round =
    "grid size-9 place-content-center rounded-full bg-[rgb(10_10_12/0.72)] text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] transition-colors duration-150 hover:bg-[rgb(40_40_46/0.9)]";

  return (
    <div className="group/tile">
      <div
        className={`relative aspect-square overflow-hidden rounded-xl bg-panel-hover ${isNow ? "shadow-[0_0_0_3px_var(--glow-1)]" : ""}`}
      >
        <button
          type="button"
          disabled={off}
          onClick={onPlay}
          onMouseEnter={onPoint}
          onFocus={onPoint}
          aria-label={`${isNow && playing ? "Пауза" : "Слушать"}: ${track.title}${badge ? `, ${badge}` : ""}`}
          className="absolute inset-0 rounded-xl"
        >
          <Artwork
            url={track.artworkUrl}
            size={500}
            className={`size-full transition-transform duration-300 ease-out group-hover/tile:scale-[1.04] ${off ? "opacity-35" : ""}`}
          />
        </button>
        {/* A dim veil and the big play round: pointer-transparent, the cover button underneath takes the click. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-black/35 transition-opacity duration-150 group-focus-within/tile:opacity-100 group-hover/tile:opacity-100 ${menu ? "opacity-100" : "opacity-0"}`}
        />
        {!off && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 scale-90 place-content-center rounded-full bg-white text-ink opacity-0 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.8)] transition-[opacity,scale] duration-150 group-focus-within/tile:scale-100 group-focus-within/tile:opacity-100 group-hover/tile:scale-100 group-hover/tile:opacity-100"
          >
            {isNow && playing ? (
              <Pause className="size-6 fill-current stroke-none" />
            ) : (
              <Play className="size-6 translate-x-px fill-current stroke-none" />
            )}
          </span>
        )}
        {track.access.preview && !off && (
          <span className="pointer-events-none absolute top-2 left-2 rounded-md bg-black/65 px-1.5 py-1 font-extrabold text-[10.5px] text-white/90 leading-none">
            Go+ · 30 с
          </span>
        )}
        {isNow && (
          <span className="pointer-events-none absolute top-2 right-2 grid size-7 place-content-center rounded-full bg-black/60 text-glow-1">
            <AudioLines className={`size-4 ${playing ? "" : "opacity-60"}`} aria-hidden="true" />
          </span>
        )}
        <div
          className={`absolute right-2 bottom-2 flex gap-1.5 transition-[opacity,translate] duration-150 group-focus-within/tile:translate-y-0 group-focus-within/tile:opacity-100 group-hover/tile:translate-y-0 group-hover/tile:opacity-100 ${menu ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
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
        </div>
      </div>
      <div className={`pt-2.5 leading-tight ${off ? "opacity-45" : ""}`}>
        <b
          title={track.title}
          className={`block truncate font-extrabold text-[14.5px] ${isNow ? "text-glow-1" : ""}`}
        >
          {track.title}
        </b>
        {off && badge ? (
          <span className="mt-0.5 block truncate font-bold text-[13px] text-fg-faint">{badge}</span>
        ) : artist ? (
          <button
            type="button"
            onClick={() => open.artist(artist)}
            className="mt-0.5 block max-w-full truncate rounded text-left font-bold text-[13px] text-fg-muted transition-colors hover:text-fg"
          >
            {artist.username}
          </button>
        ) : null}
      </div>
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

interface CoverWallProps {
  tracks: readonly Track[];
  /** Names the wall for screen readers: «Лайки». */
  label: string;
  /** Where the tracks play from: the queue's name in the player bar. */
  source: QueueSource;
  onPlay: (track: Track) => void;
}

/**
 * Tracks as a wall of big covers with their names under them, like
 * soundcloud.com's grid. Only the rows near the screen exist, so thousands of
 * likes scroll as lightly as a page; pointing at a cover lends its colours to
 * the light at the top.
 */
export function CoverWall({ tracks, label, source, onPlay }: CoverWallProps) {
  const scroller = useScrollRoot();
  const wall = useRef<HTMLUListElement>(null);
  const [width, setWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  const nowId = usePlayer((s) => currentTrack(s)?.id ?? null);
  const playing = usePlayer((s) => s.playing);
  const pointAt = usePointing();
  const likedIds = useLikedIds();
  const toggleLike = useToggleLike();

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

  const columns = Math.max(1, Math.floor((width + GAP_X) / (MIN_TILE + GAP_X)));
  const tile = width > 0 ? (width - GAP_X * (columns - 1)) / columns : MIN_TILE;
  const rowHeight = tile + CAPTION + GAP_Y;

  const rows = useVirtualizer({
    count: Math.ceil(tracks.length / columns),
    getScrollElement: () => scroller,
    estimateSize: () => rowHeight,
    overscan: 2,
    scrollMargin: offset,
  });
  // Every row is the same height; when that changes (a resize), re-lay them all.
  useEffect(() => {
    if (rowHeight > 0) rows.measure();
  }, [rowHeight, rows]);

  return (
    <ul
      ref={wall}
      aria-label={label}
      onMouseLeave={() => pointAt(null)}
      onBlur={(event) => leavesGroup(event) && pointAt(null)}
      className="relative"
      style={{ height: Math.max(0, rows.getTotalSize() - GAP_Y) }}
    >
      {rows.getVirtualItems().flatMap((row) =>
        tracks.slice(row.index * columns, row.index * columns + columns).map((track, column) => {
          const index = row.index * columns + column;
          const isNow = track.id === nowId;
          const liked = likedIds.has(track.id);
          return (
            <li
              key={`${track.id}:${index}`}
              aria-posinset={index + 1}
              aria-setsize={tracks.length}
              className="absolute top-0 left-0 focus-within:z-10 hover:z-10"
              style={{
                width: tile,
                transform: `translate(${column * (tile + GAP_X)}px, ${row.start - offset}px)`,
              }}
            >
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
        }),
      )}
    </ul>
  );
}

/** Quiet tiles in the wall's own rhythm while it loads. */
export function WallSkeleton({ count = 12 }: { count?: number }) {
  return (
    <ul
      aria-hidden="true"
      className="grid gap-x-6 gap-y-7"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_TILE}px, 1fr))` }}
    >
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders with no identity
        <li key={i}>
          <span className="block aspect-square rounded-xl bg-panel" />
          <span className="mt-3 block h-3 w-3/4 rounded bg-panel" />
          <span className="mt-2 block h-2.5 w-1/2 rounded bg-panel/70" />
        </li>
      ))}
    </ul>
  );
}
