import { Play, Shuffle } from "lucide-react";
import { useMemo, useRef } from "react";
import type { Me, Playlist, Track, TrackOrPlaylist } from "@/api/types";
import { useOpenView } from "@/features/library/nav";
import { playInOrder, playShuffled } from "@/features/library/play";
import { useAllReposts } from "@/features/library/queries";
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
import { PlaylistTile, TileGrid, TileSkeleton } from "@/features/library/Tiles";
import { TrackList } from "@/features/library/TrackList";
import { useListFilter } from "@/features/library/useListFilter";
import { usePlayPlaylist } from "@/features/library/views/CollectionViews";
import { formatCount, plural } from "@/ui/format";
import { CoverMosaic, latestCovers } from "@/ui/Mosaic";

const repostText = (item: TrackOrPlaylist) => `${item.title} ${item.user?.username ?? ""}`;

/** «Репосты»: the tracks you shared, ready to play; then the playlists, ready to open. */
export function RepostsView({ me }: { me: Me }) {
  const reposts = useAllReposts();
  const open = useOpenView();
  const { play, busyId } = usePlayPlaylist();
  const start = useRef<HTMLDivElement>(null);
  const { query, onQuery, shown, filtering } = useListFilter(reposts.items, repostText, start);
  const source = { kind: "reposts" } as const;

  const { tracks, playlists } = useMemo(() => {
    const tracks: Track[] = [];
    const playlists: Playlist[] = [];
    for (const item of shown) {
      if (item.kind === "track") tracks.push(item);
      else playlists.push(item);
    }
    return { tracks, playlists };
  }, [shown]);

  const total = reposts.items.length;
  const lead = reposts.pending
    ? "Загружаю репосты…"
    : `${formatCount(total)} ${plural(total, ["репост", "репоста", "репостов"])}`;

  return (
    <>
      <StageHeader
        title="Репосты"
        lead={lead}
        aside={
          <CoverMosaic
            covers={latestCovers(reposts.items)}
            fallback={null}
            coverSize={500}
            className={asideCover}
          />
        }
      />
      <StageActions>
        <button
          type="button"
          disabled={tracks.length === 0}
          onClick={() => playShuffled(tracks, source)}
          className={primaryButton}
        >
          <Shuffle className="size-5" aria-hidden="true" />
          Перемешать
        </button>
        <button
          type="button"
          disabled={tracks.length === 0}
          onClick={() => playInOrder(tracks, source)}
          aria-label="Слушать по порядку"
          title="Слушать по порядку"
          className={roundButton}
        >
          <Play className="size-5 fill-current stroke-none" aria-hidden="true" />
        </button>
        <FilterField
          value={query}
          onChange={onQuery}
          placeholder="Найти в репостах"
          found={foundLine(filtering, shown.length, total)}
        />
      </StageActions>
      <div ref={start} />
      {reposts.error && total === 0 ? (
        <StageNote error={reposts.error} onRetry={reposts.retry} />
      ) : reposts.pending ? (
        <TileSkeleton count={4} />
      ) : total === 0 ? (
        <StageNote text="Репостов пока нет. Сделай репост трека на SoundCloud — он появится здесь." />
      ) : shown.length === 0 ? (
        <NoMatch query={query} />
      ) : (
        <>
          {tracks.length > 0 && (
            <TrackList
              tracks={tracks}
              label="Репосты: треки"
              onPlay={(track) => playInOrder(tracks, source, track)}
            />
          )}
          {playlists.length > 0 && (
            <section aria-labelledby="reposted-playlists" className="mt-10">
              <h2
                id="reposted-playlists"
                className="mb-[18px] font-bold font-display text-[19px] leading-none tracking-[-0.02em]"
              >
                Плейлисты и альбомы
              </h2>
              <TileGrid label="Репосты: плейлисты и альбомы">
                {playlists.map((playlist) => (
                  <PlaylistTile
                    key={playlist.id}
                    playlist={playlist}
                    line={
                      playlist.user && playlist.user.id !== me.user.id
                        ? playlist.user.username
                        : `${formatCount(playlist.trackCount)} ${plural(playlist.trackCount, ["трек", "трека", "треков"])}`
                    }
                    busy={busyId === playlist.id}
                    onOpen={() => open({ kind: "playlist", playlist, from: "reposts" })}
                    onPlay={() => play(playlist)}
                  />
                ))}
              </TileGrid>
            </section>
          )}
        </>
      )}
      {reposts.error && total > 0 ? (
        <StageNote
          text="Загрузились не все репосты."
          error={reposts.error}
          onRetry={reposts.retry}
        />
      ) : null}
    </>
  );
}
