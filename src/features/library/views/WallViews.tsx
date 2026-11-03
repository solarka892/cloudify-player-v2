import { useMemo, useRef } from "react";
import type { Me, TrackOrPlaylist } from "@/api/types";
import { CoverWall, WallSkeleton } from "@/features/library/CoverWall";
import { playInOrder, playShuffled, shuffleLikes, trackText } from "@/features/library/play";
import { useAllLikes, useAllReposts, useRecentPlays } from "@/features/library/queries";
import { foundLine, NoMatch, StageNote } from "@/features/library/Stage";
import { useListFilter } from "@/features/library/useListFilter";
import { SectionTitle, SectionTop } from "@/features/library/views/actions";
import { PlaylistGrid } from "@/features/library/views/CollectionViews";
import { formatCount } from "@/ui/format";

/** «Лайки»: every like as a wall of covers. «Перемешать все» really means all of them. */
export function LikesWallView({ me }: { me: Me }) {
  const likes = useAllLikes();
  const tracks = useMemo(() => likes.items.map((like) => like.track), [likes.items]);
  const start = useRef<HTMLDivElement>(null);
  const { query, onQuery, shown, filtering } = useListFilter(tracks, trackText, start);

  const total = tracks.length;
  const count = likes.complete ? total : me.user.likesCount;
  return (
    <>
      <SectionTop
        me={me}
        shuffle={{
          label: filtering
            ? "Перемешать найденное"
            : count
              ? `Перемешать все ${formatCount(count)}`
              : "Перемешать все",
          run: () => shuffleLikes(tracks, query, likes.complete),
          disabled: shown.length === 0,
        }}
        query={query}
        onQuery={onQuery}
        placeholder="Найти в лайках"
        found={foundLine(filtering, shown.length, total)}
      />
      <div ref={start} />
      <section aria-labelledby="likes-wall">
        <SectionTitle
          id="likes-wall"
          title="Лайки"
          count={
            filtering
              ? `нашлось ${formatCount(shown.length)}`
              : likes.complete
                ? formatCount(total)
                : count
                  ? `загружено ${formatCount(total)} из ${formatCount(count)}`
                  : null
          }
        />
        {likes.error && total === 0 ? (
          <StageNote error={likes.error} onRetry={likes.retry} />
        ) : likes.pending ? (
          <WallSkeleton />
        ) : total === 0 ? (
          <StageNote text="Пока нет лайков. Поставь сердечко треку на SoundCloud — он появится здесь." />
        ) : shown.length === 0 ? (
          <NoMatch query={query} />
        ) : (
          <CoverWall
            tracks={shown}
            label="Лайки"
            named={filtering}
            onPlay={(track) => playInOrder(shown, { kind: "likes" }, track)}
          />
        )}
        {likes.error && total > 0 ? (
          <StageNote
            text={`Загрузились не все лайки, только ${formatCount(total)}.`}
            error={likes.error}
            onRetry={likes.retry}
          />
        ) : null}
      </section>
    </>
  );
}

/** «История»: what you played on SoundCloud lately, newest first, as covers. */
export function HistoryView({ me }: { me: Me }) {
  const plays = useRecentPlays();
  const tracks = useMemo(() => plays.items.map((play) => play.track), [plays.items]);
  const start = useRef<HTMLDivElement>(null);
  const { query, onQuery, shown, filtering } = useListFilter(tracks, trackText, start);
  const source = { kind: "history" } as const;

  return (
    <>
      <SectionTop
        me={me}
        shuffle={{
          label: filtering ? "Перемешать найденное" : "Перемешать историю",
          run: () => playShuffled(shown, source),
          disabled: shown.length === 0,
        }}
        query={query}
        onQuery={onQuery}
        placeholder="Найти в истории"
        found={foundLine(filtering, shown.length, tracks.length)}
      />
      <div ref={start} />
      <section aria-labelledby="history-wall">
        <SectionTitle id="history-wall" title="Недавно играло" />
        {plays.error && tracks.length === 0 ? (
          <StageNote error={plays.error} onRetry={plays.retry} />
        ) : plays.pending ? (
          <WallSkeleton />
        ) : tracks.length === 0 ? (
          <StageNote text="История пуста: SoundCloud пока не помнит, что ты слушал." />
        ) : shown.length === 0 ? (
          <NoMatch query={query} />
        ) : (
          <CoverWall
            tracks={shown}
            label="История"
            named={filtering}
            onPlay={(track) => playInOrder(shown, source, track)}
          />
        )}
      </section>
    </>
  );
}

/** «Репосты»: the tracks you shared as covers to play, then the playlists to open. */
export function RepostsView({ me }: { me: Me }) {
  const reposts = useAllReposts();
  const start = useRef<HTMLDivElement>(null);
  const { query, onQuery, shown, filtering } = useListFilter(
    reposts.items,
    playlistTextOrTrack,
    start,
  );
  const source = { kind: "reposts" } as const;
  const tracks = useMemo(
    () =>
      shown.filter((item): item is TrackOrPlaylist & { kind: "track" } => item.kind === "track"),
    [shown],
  );
  const playlists = useMemo(
    () =>
      shown.filter(
        (item): item is TrackOrPlaylist & { kind: "playlist" } => item.kind === "playlist",
      ),
    [shown],
  );
  const total = reposts.items.length;

  return (
    <>
      <SectionTop
        me={me}
        shuffle={{
          label: filtering ? "Перемешать найденное" : "Перемешать репосты",
          run: () => playShuffled(tracks, source),
          disabled: tracks.length === 0,
        }}
        query={query}
        onQuery={onQuery}
        placeholder="Найти в репостах"
        found={foundLine(filtering, shown.length, total)}
      />
      <div ref={start} />
      {reposts.error && total === 0 ? (
        <StageNote error={reposts.error} onRetry={reposts.retry} />
      ) : reposts.pending ? (
        <WallSkeleton />
      ) : total === 0 ? (
        <StageNote text="Репостов пока нет. Сделай репост трека на SoundCloud — он появится здесь." />
      ) : shown.length === 0 ? (
        <NoMatch query={query} />
      ) : (
        <>
          {tracks.length > 0 && (
            <section aria-labelledby="reposted-tracks" className="mb-10">
              <SectionTitle id="reposted-tracks" title="Треки" count={formatCount(tracks.length)} />
              <CoverWall
                tracks={tracks}
                label="Репосты: треки"
                named={filtering}
                onPlay={(track) => playInOrder(tracks, source, track)}
              />
            </section>
          )}
          {playlists.length > 0 && (
            <section aria-labelledby="reposted-playlists">
              <SectionTitle
                id="reposted-playlists"
                title="Плейлисты и альбомы"
                count={formatCount(playlists.length)}
              />
              <PlaylistGrid items={playlists} me={me} from="reposts" label="Репосты: плейлисты" />
            </section>
          )}
        </>
      )}
    </>
  );
}

function playlistTextOrTrack(item: { title: string; user: { username: string } | null }): string {
  return `${item.title} ${item.user?.username ?? ""}`;
}
