import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { playlist as fetchPlaylist } from "@/api/library";
import type { Me, Playlist } from "@/api/types";
import { type SectionId, useOpenView } from "@/features/library/nav";
import { playInOrder } from "@/features/library/play";
import { useAllAlbums, useAllLikedPlaylists, useAllPlaylists } from "@/features/library/queries";
import { foundLine, NoMatch, StageNote } from "@/features/library/Stage";
import { PlaylistTile, TileGrid, TileSkeleton } from "@/features/library/Tiles";
import { useListFilter } from "@/features/library/useListFilter";
import { SectionTop, useShuffleAllLikes } from "@/features/library/views/actions";
import { Held } from "@/features/problems/Held";
import { actionFailed } from "@/features/problems/watch";
import { actionWords } from "@/features/problems/words";
import { formatCount, plural } from "@/ui/format";

const TRACKS = ["трек", "трека", "треков"] as const;

const playlistText = (playlist: Playlist) => `${playlist.title} ${playlist.user?.username ?? ""}`;

/** Plays a playlist from its first track, fetching it whole first; one at a time. */
export function usePlayPlaylist() {
  const client = useQueryClient();
  const play = useMutation({
    mutationFn: (item: Playlist) =>
      client.fetchQuery({
        queryKey: ["playlist", item.id],
        queryFn: () => fetchPlaylist(item.id),
      }),
    onSuccess: (full) =>
      playInOrder(full.tracks ?? [], { kind: "playlist", title: full.title, id: full.id }),
    onError: (error, item) =>
      actionFailed(
        "play-playlist",
        actionWords("Плейлист не включился", `«${item.title}» не загрузился.`, error),
        error,
      ),
  });
  return {
    play: (item: Playlist) => play.mutate(item),
    busyId: play.isPending ? (play.variables?.id ?? null) : null,
  };
}

/** Under a tile's title: the count for your own, the author (and year) for anyone else's. */
export function tileLine(playlist: Playlist, me: Me): string {
  if (playlist.user && playlist.user.id !== me.user.id) {
    const year = playlist.isAlbum && playlist.createdAt ? playlist.createdAt.slice(0, 4) : null;
    return year ? `${playlist.user.username} · ${year}` : playlist.user.username;
  }
  return `${formatCount(playlist.trackCount)} ${plural(playlist.trackCount, TRACKS)}`;
}

/** Playlists and albums as tiles: the tile opens, the white round plays. */
export function PlaylistGrid({
  items,
  me,
  from,
  label,
}: {
  items: readonly Playlist[];
  me: Me;
  from: SectionId;
  label: string;
}) {
  const open = useOpenView();
  const { play, busyId } = usePlayPlaylist();
  return (
    <TileGrid label={label}>
      {items.map((playlist) => (
        <PlaylistTile
          key={playlist.id}
          playlist={playlist}
          line={tileLine(playlist, me)}
          busy={busyId === playlist.id}
          onOpen={() => open({ kind: "playlist", playlist, from })}
          onPlay={() => play(playlist)}
        />
      ))}
    </TileGrid>
  );
}

function CollectionView({
  me,
  section,
  title,
  placeholder,
  empty,
  items,
  pending,
  error,
}: {
  me: Me;
  section: SectionId;
  title: string;
  placeholder: string;
  empty: string;
  items: Playlist[];
  pending: boolean;
  error: unknown;
}) {
  const shuffle = useShuffleAllLikes(me);
  const start = useRef<HTMLDivElement>(null);
  const { query, onQuery, shown, filtering } = useListFilter(items, playlistText, start);

  return (
    <>
      <SectionTop
        me={me}
        shuffle={shuffle}
        query={query}
        onQuery={onQuery}
        placeholder={placeholder}
        found={foundLine(filtering, shown.length, items.length)}
      />
      <div ref={start} />
      {error && items.length === 0 ? (
        <Held error={error} frames={<TileSkeleton />} />
      ) : pending ? (
        <TileSkeleton />
      ) : items.length === 0 ? (
        <StageNote text={empty} />
      ) : shown.length === 0 ? (
        <NoMatch query={query} />
      ) : (
        <PlaylistGrid items={shown} me={me} from={section} label={title} />
      )}
      {error && items.length > 0 ? <Held error={error} rest /> : null}
    </>
  );
}

/** «Плейлисты»: your own first, then the ones you liked. */
export function PlaylistsView({ me }: { me: Me }) {
  const own = useAllPlaylists();
  const liked = useAllLikedPlaylists();
  const likedOnly = useMemo(() => liked.items.filter((p) => !p.isAlbum), [liked.items]);
  const items = useMemo(() => [...own.items, ...likedOnly], [own.items, likedOnly]);
  return (
    <CollectionView
      me={me}
      section="playlists"
      title="Плейлисты"
      placeholder="Найти плейлист"
      empty="Плейлистов пока нет: ни своих, ни лайкнутых. Собери первый на SoundCloud — он появится здесь."
      items={items}
      pending={own.pending || liked.pending}
      error={own.error ?? liked.error}
    />
  );
}

/** «Альбомы»: your own releases and the albums you liked. */
export function AlbumsView({ me }: { me: Me }) {
  const own = useAllAlbums();
  const liked = useAllLikedPlaylists();
  const likedAlbums = useMemo(() => liked.items.filter((p) => p.isAlbum), [liked.items]);
  const items = useMemo(() => [...own.items, ...likedAlbums], [own.items, likedAlbums]);
  return (
    <CollectionView
      me={me}
      section="albums"
      title="Альбомы"
      placeholder="Найти альбом"
      empty="Альбомов пока нет. Лайкни альбом на SoundCloud — он появится здесь."
      items={items}
      pending={own.pending || liked.pending}
      error={own.error ?? liked.error}
    />
  );
}
