import { Play, Shuffle } from "lucide-react";
import { useMemo, useRef } from "react";
import type { Me, Track } from "@/api/types";
import { playInOrder, shuffleLikes, trackText } from "@/features/library/play";
import { useAllLikes } from "@/features/library/queries";
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
import { formatCount, formatLength, plural, shortDate } from "@/ui/format";
import { CoverMosaic, latestCovers } from "@/ui/Mosaic";

export const TRACKS = ["трек", "трека", "треков"] as const;

/** «Лайки»: every like, filtered as you type; «Перемешать все» really means all of them. */
export function LikesView({ me }: { me: Me }) {
  const likes = useAllLikes();
  const tracks = useMemo(() => likes.items.map((like) => like.track), [likes.items]);
  const likedAt = useMemo(
    () => new Map(likes.items.map((like) => [like.track.id, like.likedAt])),
    [likes.items],
  );
  const length = useMemo(() => tracks.reduce((sum, t) => sum + t.fullDurationMs, 0), [tracks]);
  const start = useRef<HTMLDivElement>(null);
  const { query, onQuery, shown, filtering } = useListFilter(tracks, trackText, start);

  const total = tracks.length;
  const expected = me.user.likesCount;
  let lead: string;
  if (likes.pending) lead = "Загружаю лайки…";
  else if (!likes.complete && !likes.error) {
    lead = `Загружено ${formatCount(total)}${expected ? ` из ${formatCount(expected)}` : ""}…`;
  } else lead = `${formatCount(total)} ${plural(total, TRACKS)} · ${formatLength(length)}`;

  const note = (track: Track) => {
    const at = likedAt.get(track.id);
    return at ? shortDate(at) : null;
  };

  return (
    <>
      <StageHeader
        title="Лайки"
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
          onClick={() => shuffleLikes(tracks, query, likes.complete)}
          className={primaryButton}
        >
          <Shuffle className="size-5" aria-hidden="true" />
          {filtering ? "Перемешать найденное" : "Перемешать все"}
        </button>
        <button
          type="button"
          disabled={shown.length === 0}
          onClick={() => playInOrder(shown, { kind: "likes" })}
          aria-label="Слушать по порядку"
          title="Слушать по порядку"
          className={roundButton}
        >
          <Play className="size-5 fill-current stroke-none" aria-hidden="true" />
        </button>
        <FilterField
          value={query}
          onChange={onQuery}
          placeholder="Найти в лайках"
          found={foundLine(filtering, shown.length, total)}
        />
      </StageActions>
      <div ref={start} />
      {likes.error && total === 0 ? (
        <StageNote error={likes.error} onRetry={likes.retry} />
      ) : likes.pending ? (
        <TrackListSkeleton />
      ) : total === 0 ? (
        <StageNote text="Пока нет лайков. Поставь сердечко треку на SoundCloud — он появится здесь." />
      ) : shown.length === 0 ? (
        <NoMatch query={query} />
      ) : (
        <TrackList
          tracks={shown}
          label="Лайки"
          onPlay={(track) => playInOrder(shown, { kind: "likes" }, track)}
          note={note}
        />
      )}
      {likes.error && total > 0 ? (
        <StageNote
          text={`Загрузились не все лайки, только ${formatCount(total)}.`}
          error={likes.error}
          onRetry={likes.retry}
        />
      ) : null}
    </>
  );
}
