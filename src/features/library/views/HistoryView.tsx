import { Play, Shuffle } from "lucide-react";
import { useMemo, useRef } from "react";
import type { Track } from "@/api/types";
import { playInOrder, playShuffled, trackText } from "@/features/library/play";
import { useRecentPlays } from "@/features/library/queries";
import {
  asideCover,
  FilterField,
  foundLine,
  NoMatch,
  primaryButton,
  roundButton,
  StageActions,
  StageHeader,
  StageNote,
} from "@/features/library/Stage";
import { TrackList, TrackListSkeleton } from "@/features/library/TrackList";
import { useListFilter } from "@/features/library/useListFilter";
import { shortDate } from "@/ui/format";
import { CoverMosaic, latestCovers } from "@/ui/Mosaic";

/** «История»: what you played on SoundCloud lately, each track once, newest first. */
export function HistoryView() {
  const plays = useRecentPlays();
  const tracks = useMemo(() => plays.items.map((play) => play.track), [plays.items]);
  const playedAt = useMemo(
    () => new Map(plays.items.map((play) => [play.track.id, play.playedAt])),
    [plays.items],
  );
  const start = useRef<HTMLDivElement>(null);
  const { query, onQuery, shown, filtering } = useListFilter(tracks, trackText, start);
  const source = { kind: "history" } as const;
  const lead = plays.pending
    ? "Загружаю историю…"
    : "Что ты недавно слушал на SoundCloud, сначала последнее.";

  const note = (track: Track) => {
    const at = playedAt.get(track.id);
    return at ? shortDate(at) : null;
  };

  return (
    <>
      <StageHeader
        title="История"
        lead={lead}
        aside={
          <CoverMosaic
            covers={latestCovers(tracks)}
            fallback={null}
            coverSize={500}
            className={asideCover}
          />
        }
      />
      <StageActions>
        <button
          type="button"
          disabled={shown.length === 0}
          onClick={() => playInOrder(shown, source)}
          className={primaryButton}
        >
          <Play className="size-5 fill-current stroke-none" aria-hidden="true" />
          Слушать
        </button>
        <button
          type="button"
          disabled={shown.length === 0}
          onClick={() => playShuffled(shown, source)}
          aria-label="Перемешать"
          title="Перемешать"
          className={roundButton}
        >
          <Shuffle className="size-5" aria-hidden="true" />
        </button>
        <FilterField
          value={query}
          onChange={onQuery}
          placeholder="Найти в истории"
          found={foundLine(filtering, shown.length, tracks.length)}
        />
      </StageActions>
      <div ref={start} />
      {plays.error && tracks.length === 0 ? (
        <StageNote error={plays.error} onRetry={plays.retry} />
      ) : plays.pending ? (
        <TrackListSkeleton />
      ) : tracks.length === 0 ? (
        <StageNote text="История пуста: SoundCloud пока не помнит, что ты слушал." />
      ) : shown.length === 0 ? (
        <NoMatch query={query} />
      ) : (
        <TrackList
          tracks={shown}
          label="История"
          onPlay={(track) => playInOrder(shown, source, track)}
          note={note}
        />
      )}
    </>
  );
}
