import { useVirtualizer } from "@tanstack/react-virtual";
import { AudioLines, Pause, Play } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { Track } from "@/api/types";
import { useScrollRoot } from "@/app/scrollRoot";
import { currentTrack, usePlayer } from "@/features/player/store";
import { canPlay } from "@/features/selection/buildQueue";
import { Artwork } from "@/ui/Artwork";
import { formatDuration } from "@/ui/format";
import { stateBadge } from "@/ui/trackState";

const ROW = 50;

interface TrackListProps {
  tracks: readonly Track[];
  /** Names the list for screen readers: «Лайки». */
  label: string;
  /** Plays the list from this track. */
  onPlay: (track: Track) => void;
  /** A quiet note on wide stages: when it was liked or played. */
  note?: (track: Track) => string | null;
}

/**
 * A track list of any length. Only the rows near the screen exist, so a few
 * thousand likes scroll and filter as lightly as five; the page itself is the
 * scroller, so the header and the rail stay where they are.
 */
export function TrackList({ tracks, label, onPlay, note }: TrackListProps) {
  const scroller = useScrollRoot();
  const list = useRef<HTMLUListElement>(null);
  const [offset, setOffset] = useState(0);
  const nowId = usePlayer((s) => currentTrack(s)?.id ?? null);
  const playing = usePlayer((s) => s.playing);

  // Where the list starts inside the scroller; anything above it can change height.
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
    overscan: 12,
    scrollMargin: offset,
  });

  return (
    <ul ref={list} aria-label={label} className="relative" style={{ height: rows.getTotalSize() }}>
      {rows.getVirtualItems().map((row) => {
        const track = tracks[row.index];
        if (!track) return null;
        const isNow = track.id === nowId;
        return (
          <li
            key={row.key}
            aria-posinset={row.index + 1}
            aria-setsize={tracks.length}
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${row.start - offset}px)` }}
          >
            <TrackRow
              track={track}
              isNow={isNow}
              playing={isNow && playing}
              note={note?.(track) ?? null}
              onPlay={() => (isNow ? usePlayer.getState().toggle() : onPlay(track))}
            />
          </li>
        );
      })}
    </ul>
  );
}

function TrackRow({
  track,
  isNow,
  playing,
  note,
  onPlay,
}: {
  track: Track;
  isNow: boolean;
  playing: boolean;
  note: string | null;
  onPlay: () => void;
}) {
  const badge = stateBadge(track);
  const off = !canPlay(track);
  const Glyph = isNow && playing ? Pause : Play;
  return (
    <button
      type="button"
      disabled={off}
      onClick={onPlay}
      aria-current={isNow ? "true" : undefined}
      title={off && badge ? `Не играет: ${badge}` : undefined}
      className="group -mx-2 grid h-[50px] w-[calc(100%+16px)] grid-cols-[44px_minmax(0,1fr)_auto_46px] items-center gap-3.5 rounded-xl px-2 text-left transition-colors duration-150 hover:bg-white/5 disabled:hover:bg-transparent @2xl:grid-cols-[44px_minmax(0,1fr)_auto_7.5rem_46px]"
    >
      <span className="relative size-11">
        <Artwork
          url={track.artworkUrl}
          size={100}
          className={`size-11 rounded-[9px] ${off ? "opacity-40" : ""}`}
        />
        {!off && (
          <span
            className={`absolute inset-0 grid place-content-center rounded-[9px] bg-black/55 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${isNow ? "opacity-100" : "opacity-0"}`}
          >
            {isNow && playing ? (
              <>
                <AudioLines
                  className="size-[18px] text-glow-1 group-hover:hidden group-focus-visible:hidden"
                  aria-hidden="true"
                />
                <Glyph
                  className="hidden size-4 fill-current stroke-none group-hover:block group-focus-visible:block"
                  aria-hidden="true"
                />
              </>
            ) : (
              <Glyph className="size-4 fill-current stroke-none" aria-hidden="true" />
            )}
          </span>
        )}
      </span>
      <span className={`min-w-0 ${off ? "opacity-40" : ""}`}>
        <b className={`block truncate font-extrabold text-[14.5px] ${isNow ? "text-glow-1" : ""}`}>
          {track.title}
        </b>
        <span className="block truncate font-bold text-[13px] text-fg-muted">
          {track.user?.username}
        </span>
      </span>
      <span>
        {badge && (
          <span className="whitespace-nowrap rounded-lg bg-white/[0.07] px-2 py-1 font-extrabold text-[11px] text-fg-muted leading-none">
            {badge}
          </span>
        )}
      </span>
      <span className="hidden truncate text-right font-bold text-[12.5px] text-fg-faint tabular-nums @2xl:block">
        {note}
      </span>
      <span className="text-right font-bold text-fg-faint tabular-nums">
        {formatDuration(track.fullDurationMs)}
      </span>
    </button>
  );
}

/** Quiet rows in the list's own rhythm while it loads. */
export function TrackListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders with no identity
        <li key={i} className="flex h-[50px] items-center gap-3.5">
          <span className="size-11 rounded-[9px] bg-panel" />
          <span className="flex flex-col gap-2">
            <span
              className="h-3 rounded bg-panel"
              style={{ width: `${180 + ((i * 53) % 140)}px` }}
            />
            <span className="h-2.5 w-24 rounded bg-panel/70" />
          </span>
        </li>
      ))}
    </ul>
  );
}
