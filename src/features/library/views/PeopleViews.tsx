import { useMutation } from "@tanstack/react-query";
import { Play, Radio } from "lucide-react";
import { useMemo, useRef } from "react";
import { artistStation } from "@/api/player";
import type { Me, Track, User } from "@/api/types";
import { CoverWall, WallSkeleton } from "@/features/library/CoverWall";
import { SECTION_NAMES, type SectionId, useOpenView } from "@/features/library/nav";
import { playInOrder, trackText } from "@/features/library/play";
import { useAllFollowings, useAllLikes, useTopTracks } from "@/features/library/queries";
import {
  FilterField,
  foundLine,
  NoMatch,
  primaryButton,
  roundButton,
  StageActions,
  StageHeader,
  StageNote,
} from "@/features/library/Stage";
import { PersonTile, StationTile, TileGrid, TileSkeleton } from "@/features/library/Tiles";
import { useListFilter } from "@/features/library/useListFilter";
import { SectionTitle, SectionTop, useShuffleAllLikes } from "@/features/library/views/actions";
import { usePlayer } from "@/features/player/store";
import { Artwork } from "@/ui/Artwork";
import { describeError } from "@/ui/errors";
import { formatCount, plural } from "@/ui/format";

const FOLLOWERS = ["подписчик", "подписчика", "подписчиков"] as const;
const TRACKS = ["трек", "трека", "треков"] as const;
const userText = (user: User) => `${user.username} ${user.fullName ?? ""}`;
const artistText = (entry: { user: User }) => entry.user.username;

function followersLine(user: User): string {
  const n = user.followersCount;
  return n == null ? "" : `${formatCount(n)} ${plural(n, FOLLOWERS)}`;
}

/** Plays an artist's radio; one at a time, with the reason when SoundCloud says no. */
export function useArtistRadio() {
  const radio = useMutation({
    mutationFn: (user: User) => artistStation(user.id),
    onSuccess: (tracks, user) => playInOrder(tracks, { kind: "station", title: user.username }),
    onError: (error) => usePlayer.getState().say(describeError(error)),
  });
  return {
    play: (user: User) => radio.mutate(user),
    busyId: radio.isPending ? (radio.variables?.id ?? null) : null,
  };
}

/** «Подписки»: the people you follow; each opens their popular tracks and radio. */
export function FollowingsView({ me }: { me: Me }) {
  const followings = useAllFollowings();
  const open = useOpenView();
  const shuffle = useShuffleAllLikes(me);
  const start = useRef<HTMLDivElement>(null);
  const { query, onQuery, shown, filtering } = useListFilter(followings.items, userText, start);
  const total = followings.items.length;

  return (
    <>
      <SectionTop
        me={me}
        shuffle={shuffle}
        query={query}
        onQuery={onQuery}
        placeholder="Найти в подписках"
        found={foundLine(filtering, shown.length, total)}
      />
      <div ref={start} />
      {followings.error && total === 0 ? (
        <StageNote error={followings.error} onRetry={followings.retry} />
      ) : followings.pending ? (
        <TileSkeleton round />
      ) : total === 0 ? (
        <StageNote text="Ты пока ни на кого не подписан." />
      ) : shown.length === 0 ? (
        <NoMatch query={query} />
      ) : (
        <TileGrid label="Подписки">
          {shown.map((user) => (
            <PersonTile
              key={user.id}
              user={user}
              line={followersLine(user)}
              onOpen={() => open({ kind: "artist", user, from: "followings" })}
            />
          ))}
        </TileGrid>
      )}
    </>
  );
}

/** The artists you like most, by how many of their tracks sit in your likes. */
export function topArtists(
  tracks: readonly Track[],
  limit: number,
): { user: User; count: number }[] {
  const byArtist = new Map<number, { user: User; count: number }>();
  for (const track of tracks) {
    if (!track.user) continue;
    const entry = byArtist.get(track.user.id);
    if (entry) entry.count += 1;
    else byArtist.set(track.user.id, { user: track.user, count: 1 });
  }
  return [...byArtist.values()]
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** «Станции»: radio from the artists that fill your likes the most. Pressing one plays it. */
export function StationsView({ me }: { me: Me }) {
  const likes = useAllLikes();
  const radio = useArtistRadio();
  const shuffle = useShuffleAllLikes(me);
  const artists = useMemo(
    () =>
      topArtists(
        likes.items.map((like) => like.track),
        24,
      ),
    [likes.items],
  );
  const start = useRef<HTMLDivElement>(null);
  const { query, onQuery, shown, filtering } = useListFilter(artists, artistText, start);

  return (
    <>
      <SectionTop
        me={me}
        shuffle={shuffle}
        query={query}
        onQuery={onQuery}
        placeholder="Найти станцию"
        found={foundLine(filtering, shown.length, artists.length)}
      />
      <div ref={start} />
      <SectionTitle
        id="stations-title"
        title={likes.complete ? "Радио твоих артистов" : "Собираю станции из лайков…"}
      />
      {likes.error && likes.items.length === 0 ? (
        <StageNote error={likes.error} onRetry={likes.retry} />
      ) : likes.pending ? (
        <TileSkeleton />
      ) : artists.length === 0 ? (
        <StageNote text="Станции появятся, когда в лайках будет хотя бы два трека одного артиста." />
      ) : shown.length === 0 ? (
        <NoMatch query={query} />
      ) : (
        <TileGrid label="Станции">
          {shown.map(({ user, count }) => (
            <StationTile
              key={user.id}
              user={user}
              line={`${formatCount(count)} ${plural(count, TRACKS)} в лайках`}
              busy={radio.busyId === user.id}
              onPlay={() => radio.play(user)}
            />
          ))}
        </TileGrid>
      )}
    </>
  );
}

/** Someone you follow, opened: their radio, and their most played tracks as covers. */
export function ArtistView({ user, from }: { user: User; from: SectionId }) {
  const open = useOpenView();
  const top = useTopTracks(user.id);
  const radio = useArtistRadio();
  const tracks = useMemo(() => top.data?.items ?? [], [top.data]);
  const start = useRef<HTMLDivElement>(null);
  const { query, onQuery, shown, filtering } = useListFilter(tracks, trackText, start);
  const source = { kind: "artist", title: user.username } as const;
  const lead = [
    followersLine(user),
    user.trackCount != null
      ? `${formatCount(user.trackCount)} ${plural(user.trackCount, TRACKS)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <StageHeader
        title={user.username}
        lead={lead || "Артист на SoundCloud"}
        back={{
          label: SECTION_NAMES[from],
          onClick: () => open({ kind: "section", section: from }),
        }}
        aside={
          <Artwork
            url={user.avatarUrl}
            size={500}
            eager
            className="aspect-square w-[clamp(180px,20cqi,240px)] rounded-full shadow-[0_30px_60px_-24px_rgb(0_0_0/0.8)]"
          />
        }
      />
      <StageActions>
        <button
          type="button"
          onClick={() => radio.play(user)}
          aria-busy={radio.busyId === user.id}
          className={primaryButton}
        >
          <Radio className="size-5" aria-hidden="true" />
          Радио артиста
        </button>
        <button
          type="button"
          disabled={shown.length === 0}
          onClick={() => playInOrder(shown, source)}
          aria-label="Слушать популярное"
          title="Слушать популярное"
          className={roundButton}
        >
          <Play className="size-5 fill-current stroke-none" aria-hidden="true" />
        </button>
        <FilterField
          value={query}
          onChange={onQuery}
          placeholder="Найти у артиста"
          found={foundLine(filtering, shown.length, tracks.length)}
        />
      </StageActions>
      <div ref={start} className="mt-5" />
      <SectionTitle id="artist-top" title="Популярное" />
      {top.isError ? (
        <StageNote error={top.error} onRetry={() => void top.refetch()} />
      ) : top.isPending ? (
        <WallSkeleton count={12} />
      ) : tracks.length === 0 ? (
        <StageNote text="У артиста пока нет треков, которые SoundCloud отдаёт." />
      ) : shown.length === 0 ? (
        <NoMatch query={query} />
      ) : (
        <CoverWall
          tracks={shown}
          label={`Популярное: ${user.username}`}
          source={source}
          onPlay={(track) => playInOrder(shown, source, track)}
        />
      )}
    </>
  );
}
