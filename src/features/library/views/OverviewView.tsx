import { useMemo, useRef } from "react";
import type { Me, Playlist, Track, TrackOrPlaylist } from "@/api/types";
import { useSectionCounts } from "@/features/library/Chips";
import { CoverWall } from "@/features/library/CoverWall";
import { makeFilter, queryWords } from "@/features/library/filter";
import { type SectionId, useOpenView } from "@/features/library/nav";
import { playInOrder, shuffleLikes, trackText } from "@/features/library/play";
import {
  useAllAlbums,
  useAllFollowings,
  useAllLikedPlaylists,
  useAllLikes,
  useAllPlaylists,
  useAllReposts,
  useRecentPlays,
} from "@/features/library/queries";
import { CoverRow, RowSkeleton, Shelf, TileRow } from "@/features/library/Rows";
import { foundLine, NoMatch, StageNote } from "@/features/library/Stage";
import { PersonTile, PlaylistTile, StationTile, TileGrid } from "@/features/library/Tiles";
import { useListFilter } from "@/features/library/useListFilter";
import { SectionTitle, SectionTop } from "@/features/library/views/actions";
import { PlaylistGrid, tileLine, usePlayPlaylist } from "@/features/library/views/CollectionViews";
import { topArtists, useArtistRadio } from "@/features/library/views/PeopleViews";
import { Held } from "@/features/problems/Held";
import { formatCount, plural } from "@/ui/format";

const TRACKS = ["трек", "трека", "треков"] as const;
const FOLLOWERS = ["подписчик", "подписчика", "подписчиков"] as const;
const playlistText = (playlist: Playlist) => `${playlist.title} ${playlist.user?.username ?? ""}`;
const userText = (user: { username: string; fullName: string | null }) =>
  `${user.username} ${user.fullName ?? ""}`;
const isTrack = (item: TrackOrPlaylist): item is TrackOrPlaylist & { kind: "track" } =>
  item.kind === "track";

/**
 * «Всё»: one row of each section, as much as fits; a section's title opens all
 * of it. Typing turns the rows into everything that matches.
 */
export function OverviewView({ me }: { me: Me }) {
  const open = useOpenView();
  const counts = useSectionCounts(me);
  const likes = useAllLikes();
  const own = useAllPlaylists();
  const liked = useAllLikedPlaylists();
  const albums = useAllAlbums();
  const reposts = useAllReposts();
  const followings = useAllFollowings();
  const plays = useRecentPlays();
  const { play: playPlaylist, busyId } = usePlayPlaylist();
  const radio = useArtistRadio();

  const likeTracks = useMemo(() => likes.items.map((like) => like.track), [likes.items]);
  const playlists = useMemo(
    () => [...own.items, ...liked.items.filter((p) => !p.isAlbum)],
    [own.items, liked.items],
  );
  const albumList = useMemo(
    () => [...albums.items, ...liked.items.filter((p) => p.isAlbum)],
    [albums.items, liked.items],
  );
  const repostTracks = useMemo(() => reposts.items.filter(isTrack), [reposts.items]);
  const recent = useMemo(() => plays.items.map((play) => play.track), [plays.items]);
  const stations = useMemo(() => topArtists(likeTracks, 24), [likeTracks]);
  // A shelf SoundCloud did not fill keeps its place, as quiet frames: nothing jumps.
  const failedPlaylists = playlists.length === 0 ? (own.error ?? liked.error) : null;
  const failedAlbums = albumList.length === 0 ? (albums.error ?? liked.error) : null;
  const failedReposts = repostTracks.length === 0 ? reposts.error : null;
  const failedFollowings = followings.items.length === 0 ? followings.error : null;
  const failedHistory = recent.length === 0 ? plays.error : null;

  const start = useRef<HTMLDivElement>(null);
  const { query, onQuery, shown, filtering } = useListFilter(likeTracks, trackText, start);
  const words = queryWords(query);
  const foundCollections = useMemo(
    () => (words.length ? makeFilter([...playlists, ...albumList], playlistText)(query) : []),
    [words.length, playlists, albumList, query],
  );
  const foundPeople = useMemo(
    () => (words.length ? makeFilter(followings.items, userText)(query) : []),
    [words.length, followings.items, query],
  );

  const likesCount = likes.complete ? likeTracks.length : me.user.likesCount;
  const openSection = (section: SectionId) => open({ kind: "section", section });
  const count = (section: SectionId) => {
    const n = counts[section];
    return n != null ? formatCount(n) : null;
  };
  const playlistTile = (playlist: Playlist) => (
    <PlaylistTile
      key={playlist.id}
      playlist={playlist}
      line={tileLine(playlist, me)}
      busy={busyId === playlist.id}
      onOpen={() => open({ kind: "playlist", playlist, from: "all" })}
      onPlay={() => playPlaylist(playlist)}
    />
  );

  return (
    <>
      <SectionTop
        me={me}
        shuffle={{
          label: filtering
            ? "Перемешать найденное"
            : likesCount
              ? `Перемешать все ${formatCount(likesCount)}`
              : "Перемешать все",
          run: () => shuffleLikes(likeTracks, query, likes.complete),
          disabled: shown.length === 0,
        }}
        query={query}
        onQuery={onQuery}
        placeholder="Найти у себя"
        found={foundLine(filtering, shown.length, likeTracks.length)}
      />
      <div ref={start} />
      {filtering ? (
        // Searching shows everything that matches, not one row of it.
        shown.length + foundCollections.length + foundPeople.length === 0 ? (
          <NoMatch query={query} />
        ) : (
          <>
            {foundCollections.length > 0 && (
              <section aria-labelledby="found-collections" className="mb-10">
                <SectionTitle
                  id="found-collections"
                  title="Плейлисты и альбомы"
                  count={formatCount(foundCollections.length)}
                />
                <PlaylistGrid
                  items={foundCollections}
                  me={me}
                  from="all"
                  label="Найденные плейлисты"
                />
              </section>
            )}
            {foundPeople.length > 0 && (
              <section aria-labelledby="found-people" className="mb-10">
                <SectionTitle
                  id="found-people"
                  title="Подписки"
                  count={formatCount(foundPeople.length)}
                />
                <TileGrid label="Найденные подписки">
                  {foundPeople.map((user) => (
                    <PersonTile
                      key={user.id}
                      user={user}
                      line={
                        user.followersCount != null
                          ? `${formatCount(user.followersCount)} ${plural(user.followersCount, FOLLOWERS)}`
                          : ""
                      }
                      onOpen={() => open({ kind: "artist", user, from: "all" })}
                    />
                  ))}
                </TileGrid>
              </section>
            )}
            {shown.length > 0 && (
              <section aria-labelledby="found-likes">
                <SectionTitle
                  id="found-likes"
                  title="Лайки"
                  count={`нашлось ${formatCount(shown.length)}`}
                />
                <CoverWall
                  tracks={shown}
                  label="Найденные лайки"
                  source={{ kind: "likes" }}
                  onPlay={(track) => playInOrder(shown, { kind: "likes" }, track)}
                />
              </section>
            )}
          </>
        )
      ) : (
        <>
          <Shelf
            id="shelf-likes"
            title="Лайки"
            count={count("likes")}
            onOpen={() => openSection("likes")}
          >
            {likes.error && likeTracks.length === 0 ? (
              <Held error={likes.error} frames={<RowSkeleton />} />
            ) : likes.pending ? (
              <RowSkeleton />
            ) : likeTracks.length === 0 ? (
              <StageNote text="Пока нет лайков. Поставь сердечко треку на SoundCloud — он появится здесь." />
            ) : (
              <CoverRow
                tracks={likeTracks}
                label="Последние лайки"
                source={{ kind: "likes" }}
                onPlay={(track) => playInOrder(likeTracks, { kind: "likes" }, track)}
              />
            )}
          </Shelf>
          {(own.pending || liked.pending || playlists.length > 0 || failedPlaylists) && (
            <Shelf
              id="shelf-playlists"
              title="Плейлисты"
              count={count("playlists")}
              onOpen={() => openSection("playlists")}
            >
              {failedPlaylists ? (
                <Held error={failedPlaylists} frames={<RowSkeleton />} />
              ) : own.pending && liked.pending ? (
                <RowSkeleton />
              ) : (
                <TileRow items={playlists} label="Плейлисты" render={playlistTile} />
              )}
              {/* The liked ones came, your own did not: the row says the rest is missing. */}
              {!failedPlaylists && own.error && own.items.length === 0 ? (
                <Held error={own.error} rest />
              ) : null}
            </Shelf>
          )}
          {(albumList.length > 0 || failedAlbums) && (
            <Shelf
              id="shelf-albums"
              title="Альбомы"
              count={count("albums")}
              onOpen={() => openSection("albums")}
            >
              {failedAlbums ? (
                <Held error={failedAlbums} frames={<RowSkeleton />} />
              ) : (
                <TileRow items={albumList} label="Альбомы" render={playlistTile} />
              )}
              {!failedAlbums && albums.error && albums.items.length === 0 ? (
                <Held error={albums.error} rest />
              ) : null}
            </Shelf>
          )}
          {(repostTracks.length > 0 || failedReposts) && (
            <Shelf
              id="shelf-reposts"
              title="Репосты"
              count={count("reposts")}
              onOpen={() => openSection("reposts")}
            >
              {failedReposts ? (
                <Held error={failedReposts} frames={<RowSkeleton />} />
              ) : (
                <CoverRow
                  tracks={repostTracks}
                  label="Последние репосты"
                  source={{ kind: "reposts" }}
                  onPlay={(track) => playInOrder(repostTracks, { kind: "reposts" }, track)}
                />
              )}
            </Shelf>
          )}
          {(followings.items.length > 0 || failedFollowings) && (
            <Shelf
              id="shelf-followings"
              title="Подписки"
              count={count("followings")}
              onOpen={() => openSection("followings")}
            >
              {failedFollowings ? (
                <Held error={failedFollowings} frames={<RowSkeleton />} />
              ) : (
                <TileRow
                  items={followings.items}
                  label="Подписки"
                  min={150}
                  render={(user) => (
                    <PersonTile
                      key={user.id}
                      user={user}
                      line={
                        user.followersCount != null
                          ? `${formatCount(user.followersCount)} ${plural(user.followersCount, FOLLOWERS)}`
                          : ""
                      }
                      onOpen={() => open({ kind: "artist", user, from: "all" })}
                    />
                  )}
                />
              )}
            </Shelf>
          )}
          {stations.length > 0 && (
            <Shelf
              id="shelf-stations"
              title="Станции"
              count={null}
              onOpen={() => openSection("stations")}
            >
              <TileRow
                items={stations}
                label="Станции"
                render={({ user, count: n }) => (
                  <StationTile
                    key={user.id}
                    user={user}
                    line={`${formatCount(n)} ${plural(n, TRACKS)} в лайках`}
                    busy={radio.busyId === user.id}
                    onPlay={() => radio.play(user)}
                  />
                )}
              />
            </Shelf>
          )}
          {(recent.length > 0 || failedHistory) && (
            <Shelf
              id="shelf-history"
              title="История"
              one
              count={null}
              onOpen={() => openSection("history")}
            >
              {failedHistory ? (
                <Held error={failedHistory} frames={<RowSkeleton />} />
              ) : (
                <CoverRow
                  tracks={recent}
                  label="Недавно играло"
                  source={{ kind: "history" }}
                  onPlay={(track: Track) => playInOrder(recent, { kind: "history" }, track)}
                />
              )}
            </Shelf>
          )}
        </>
      )}
    </>
  );
}
