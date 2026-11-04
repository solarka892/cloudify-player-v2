import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, LoaderCircle, Play, Radio } from "lucide-react";
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { artistTopTracks } from "@/api/people";
import type { Me, Playlist, Track, User } from "@/api/types";
import { useScrollRoot } from "@/app/scrollRoot";
import { useOpener } from "@/features/library/nav";
import { PageLight } from "@/features/library/PageLight";
import { playInOrder } from "@/features/library/play";
import { Shelf, TileRow } from "@/features/library/Rows";
import {
  primaryButton,
  roundButton,
  StageActions,
  StageHeader,
  StageNote,
} from "@/features/library/Stage";
import { PersonTile, PlaylistTile, TileGrid, TileSkeleton } from "@/features/library/Tiles";
import { SectionTitle } from "@/features/library/views/actions";
import { tileLine, usePlayPlaylist } from "@/features/library/views/CollectionViews";
import { ArtistView, useArtistRadio } from "@/features/library/views/PeopleViews";
import { PlaylistView } from "@/features/library/views/PlaylistView";
import { usePlayer } from "@/features/player/store";
import { bestArtist } from "@/features/search/best";
import { FilterColumn } from "@/features/search/FilterColumn";
import { hasFilters } from "@/features/search/filters";
import {
  type SearchList,
  useAlbumResults,
  usePlaylistResults,
  useTrackResults,
  useUserResults,
} from "@/features/search/queries";
import { type Category, useSearch } from "@/features/search/store";
import {
  RowsSkeleton,
  TrackListHead,
  TrackRowColumns,
  TrackRowList,
} from "@/features/search/TrackRows";
import { useLoadMore } from "@/features/search/useLoadMore";
import { Artwork } from "@/ui/Artwork";
import { describeError } from "@/ui/errors";
import { formatCount, plural } from "@/ui/format";

const TRACKS = ["трек", "трека", "треков"] as const;
const PEOPLE = ["человек", "человека", "человек"] as const;
const SETS = ["плейлист", "плейлиста", "плейлистов"] as const;
const FOLLOWERS = ["подписчик", "подписчика", "подписчиков"] as const;

const CATEGORIES: readonly (readonly [Category, string])[] = [
  ["all", "Всё"],
  ["tracks", "Треки"],
  ["users", "Люди"],
  ["playlists", "Плейлисты"],
  ["albums", "Альбомы"],
];

/** The top bar and the stuck chips (what covers the top of the page), plus a breath. */
const COVERED = 68 + 60 + 8;
/** How many found tracks «Всё» shows before «Треки» opens them all. */
const BEST_TRACKS = 10;

const counted = (n: number, words: readonly [string, string, string]) =>
  `${formatCount(n)} ${plural(n, words)}`;

function followersLine(user: User): string {
  return user.followersCount != null ? counted(user.followersCount, FOLLOWERS) : "";
}

/** Plays an artist's most played tracks, fetched the moment it is asked; one at a time. */
function usePlayTop() {
  const client = useQueryClient();
  const play = useMutation({
    mutationFn: (user: User) =>
      client.fetchQuery({
        queryKey: ["artist", user.id, "top"],
        queryFn: () => artistTopTracks(user.id, { limit: 50 }),
      }),
    onSuccess: (page, user) => playInOrder(page.items, { kind: "artist", title: user.username }),
    onError: (error) => usePlayer.getState().say(describeError(error)),
  });
  return {
    play: (user: User) => play.mutate(user),
    busyId: play.isPending ? (play.variables?.id ?? null) : null,
  };
}

/**
 * «Поиск»: the answer first — when the query names an artist, the artist with
 * their face and radio — then the tracks found as rows, then one shelf of
 * each other kind. Each kind opens in full, paged in as you scroll; tracks in
 * full come with a column of filters.
 */
export function SearchPage({ me }: { me: Me }) {
  const query = useSearch((s) => s.query) ?? "";
  const opened = useSearch((s) => s.opened);
  const users = useUserResults(query);
  const best = users.pending ? null : bestArtist(users.items, query);
  const scroller = useScrollRoot();
  // Where the results were scrolled to when something was opened from them.
  const resultsAt = useRef(0);
  const comingBack = useRef(false);

  // Whatever opens an artist or playlist here (a row, a tile, the player's
  // artist name), the results remember where they were and the page starts at the top.
  useEffect(() => {
    if (!scroller) return;
    return useSearch.subscribe((now, before) => {
      if (now.query !== before.query) {
        resultsAt.current = 0;
      } else if (now.opened && now.opened !== before.opened) {
        if (!before.opened) resultsAt.current = scroller.scrollTop;
        scroller.scrollTo({ top: 0 });
      }
    });
  }, [scroller]);

  const back = useMemo(
    () => ({
      label: "Поиск",
      onClick: () => {
        comingBack.current = true;
        useSearch.getState().back();
      },
    }),
    [],
  );

  // A new search opens at its top; coming back lands where the results were left.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs for each new query
  useEffect(() => {
    scroller?.scrollTo({ top: 0 });
  }, [query, scroller]);
  useLayoutEffect(() => {
    if (opened || !comingBack.current || !scroller) return;
    const top = resultsAt.current;
    scroller.scrollTo({ top });
    // A windowed list mounting under the page sets its own scroll first; land after it.
    const frame = requestAnimationFrame(() => {
      comingBack.current = false;
      scroller.scrollTo({ top });
    });
    return () => cancelAnimationFrame(frame);
  }, [opened, scroller]);

  const cover = opened
    ? opened.kind === "artist"
      ? opened.user.avatarUrl
      : (opened.playlist.artworkUrl ?? opened.playlist.covers[0] ?? null)
    : (best?.avatarUrl ?? null);

  return (
    // The ground behind the light is what its grain blends into; without it the grain shows as haze.
    <div className="relative isolate min-h-full bg-ground">
      <PageLight cover={cover} />
      <div className="@container relative z-10 px-14 pb-12">
        {opened?.kind === "artist" ? (
          <ArtistView key={opened.user.id} user={opened.user} back={back} />
        ) : opened?.kind === "playlist" ? (
          <PlaylistView key={opened.playlist.id} me={me} playlist={opened.playlist} back={back} />
        ) : (
          <Results key={query} me={me} query={query} best={best} users={users} />
        )}
      </div>
    </div>
  );
}

function Results({
  me,
  query,
  best,
  users,
}: {
  me: Me;
  query: string;
  best: User | null;
  users: SearchList<User>;
}) {
  const category = useSearch((s) => s.category);
  const tracks = useTrackResults(query);
  const albums = useAlbumResults(query);
  const playlists = usePlaylistResults(query);
  const scroller = useScrollRoot();
  const start = useRef<HTMLDivElement>(null);
  const source = useMemo(() => ({ kind: "search", title: query }) as const, [query]);

  const show = (next: Category) => {
    useSearch.getState().show(next);
    // Back up to where the results start, if the page has scrolled past it.
    const node = start.current;
    if (!node || !scroller) return;
    const top =
      node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    if (scroller.scrollTop > top - COVERED) scroller.scrollTo({ top: top - COVERED });
  };

  const counts: Partial<Record<Category, number | null>> = {
    tracks: tracks.total,
    users: users.total,
    playlists: playlists.total,
    albums: albums.total,
  };

  return (
    <>
      {best ? (
        <ArtistHeader user={best} />
      ) : (
        <StageHeader
          title={query}
          lead={foundLine(tracks, users, playlists)}
          actions={
            <button
              type="button"
              disabled={tracks.items.length === 0}
              onClick={() => playInOrder(tracks.items, source)}
              className={primaryButton}
            >
              <Play className="size-5 fill-current stroke-none" aria-hidden="true" />
              Слушать треки
            </button>
          }
        />
      )}
      <StageActions>
        <nav aria-label="Что показать" className="flex flex-wrap gap-2">
          {CATEGORIES.map(([id, name]) => {
            const count = counts[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => show(id)}
                aria-current={category === id ? "page" : undefined}
                className="flex h-9 items-center gap-1.5 rounded-full bg-[rgb(10_10_12/0.66)] px-[15px] font-bold text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] backdrop-blur-[6px] transition-colors duration-150 hover:text-white aria-[current=page]:bg-white aria-[current=page]:text-ink aria-[current=page]:shadow-none"
              >
                {name}
                {count != null && (
                  <span className="font-bold text-[12.5px] tabular-nums opacity-55">
                    {formatCount(count)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </StageActions>
      <div ref={start} className="mt-5" />
      {category === "all" ? (
        <Everything
          me={me}
          query={query}
          best={best}
          tracks={tracks}
          users={users}
          albums={albums}
          playlists={playlists}
          onShow={show}
        />
      ) : category === "tracks" ? (
        <AllTracks query={query} />
      ) : category === "users" ? (
        <AllPeople users={users} />
      ) : (
        <AllCollections
          me={me}
          list={category === "albums" ? albums : playlists}
          albums={category === "albums"}
        />
      )}
    </>
  );
}

/** «2 265 треков, 44 человека и 1 206 плейлистов» — SoundCloud's own estimates. */
function foundLine(
  tracks: SearchList<Track>,
  users: SearchList<User>,
  playlists: SearchList<Playlist>,
): string {
  if (tracks.pending || users.pending || playlists.pending) return "Ищу на SoundCloud…";
  const parts = [
    tracks.total ? counted(tracks.total, TRACKS) : null,
    users.total ? counted(users.total, PEOPLE) : null,
    playlists.total ? counted(playlists.total, SETS) : null,
  ].filter(Boolean);
  if (parts.length === 0) return "На SoundCloud ничего не нашлось.";
  const last = parts.pop();
  return `На SoundCloud ${parts.length ? `${parts.join(", ")} и ${last}` : last}.`;
}

/** The artist the query names, as the page's hero: their name, face and radio. */
function ArtistHeader({ user }: { user: User }) {
  const radio = useArtistRadio();
  const top = usePlayTop();
  const open = useOpener();
  const lead = [
    followersLine(user),
    user.trackCount != null ? counted(user.trackCount, TRACKS) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const busy = (spinning: boolean, icon: ReactNode) =>
    spinning ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : icon;

  return (
    <StageHeader
      title={user.username}
      open={{ label: `Открыть ${user.username}`, run: () => open.artist(user) }}
      lead={
        <>
          <span className="inline-flex items-center gap-1.5 align-[-3px]">
            Артист
            {user.verified && (
              <BadgeCheck className="size-[18px] text-glow-1" aria-label="подтверждённый" />
            )}
          </span>
          {lead ? ` · ${lead}` : ""}
        </>
      }
      aside={
        <Artwork
          url={user.avatarUrl}
          size={500}
          eager
          className="aspect-square w-[clamp(180px,20cqi,240px)] rounded-full shadow-[0_30px_60px_-24px_rgb(0_0_0/0.8)]"
        />
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => radio.play(user)}
            aria-busy={radio.busyId === user.id}
            className={primaryButton}
          >
            {busy(radio.busyId === user.id, <Radio className="size-5" aria-hidden="true" />)}
            Радио артиста
          </button>
          <button
            type="button"
            onClick={() => top.play(user)}
            aria-busy={top.busyId === user.id}
            aria-label="Слушать популярное"
            title="Слушать популярное"
            className={roundButton}
          >
            {busy(
              top.busyId === user.id,
              <Play className="size-5 fill-current stroke-none" aria-hidden="true" />,
            )}
          </button>
        </>
      }
    />
  );
}

/** «Всё»: the best tracks as rows, then one shelf of albums, playlists and people. */
function Everything({
  me,
  query,
  best,
  tracks,
  users,
  albums,
  playlists,
  onShow,
}: {
  me: Me;
  query: string;
  best: User | null;
  tracks: SearchList<Track>;
  users: SearchList<User>;
  albums: SearchList<Playlist>;
  playlists: SearchList<Playlist>;
  onShow: (category: Category) => void;
}) {
  const { play: playPlaylist, busyId } = usePlayPlaylist();
  const open = useOpener();
  const source = { kind: "search", title: query } as const;
  const shown = tracks.items.slice(0, BEST_TRACKS);
  // The found artist's own albums come first.
  const albumList = useMemo(
    () =>
      best
        ? [
            ...albums.items.filter((a) => a.user?.id === best.id),
            ...albums.items.filter((a) => a.user?.id !== best.id),
          ]
        : albums.items,
    [albums.items, best],
  );
  const setList = useMemo(() => playlists.items.filter((p) => !p.isAlbum), [playlists.items]);
  const count = (list: SearchList<unknown>) =>
    list.total != null ? formatCount(list.total) : null;
  const lists = [tracks, users, albums, playlists];

  if (lists.every((list) => !list.pending && list.items.length === 0)) {
    const failed = lists.find((list) => list.error)?.error;
    return failed ? (
      <StageNote
        text="Поиск не получился."
        error={failed}
        onRetry={() => {
          for (const list of lists) list.retry();
        }}
      />
    ) : (
      <StageNote
        text={`По «${query}» на SoundCloud ничего нет. Проверь, как написано, или попробуй короче.`}
      />
    );
  }

  const playlistTile = (playlist: Playlist) => (
    <PlaylistTile
      key={playlist.id}
      playlist={playlist}
      line={tileLine(playlist, me)}
      busy={busyId === playlist.id}
      onOpen={() => open.playlist(playlist)}
      onPlay={() => playPlaylist(playlist)}
    />
  );

  return (
    <>
      {(tracks.pending || shown.length > 0 || tracks.error) && (
        <Shelf
          id="found-tracks"
          title="Треки"
          count={count(tracks)}
          onOpen={() => onShow("tracks")}
        >
          {tracks.pending ? (
            <RowsSkeleton count={BEST_TRACKS} columns={2} />
          ) : shown.length === 0 ? (
            <StageNote error={tracks.error} onRetry={tracks.retry} />
          ) : (
            <TrackRowColumns
              tracks={shown}
              label="Лучшие треки"
              source={source}
              onPlay={(track) => playInOrder(tracks.items, source, track)}
            />
          )}
        </Shelf>
      )}
      <ShelfOf
        id="found-albums"
        title="Альбомы"
        list={albums}
        items={albumList}
        onOpen={() => onShow("albums")}
        render={playlistTile}
      />
      <ShelfOf
        id="found-playlists"
        title="Плейлисты"
        list={playlists}
        items={setList}
        onOpen={() => onShow("playlists")}
        render={playlistTile}
      />
      <ShelfOf
        id="found-people"
        title="Люди"
        list={users}
        items={users.items}
        min={150}
        onOpen={() => onShow("users")}
        render={(user) => (
          <PersonTile
            key={user.id}
            user={user}
            line={followersLine(user)}
            onOpen={() => open.artist(user)}
          />
        )}
      />
    </>
  );
}

/** One shelf of found tiles; left out when that kind found nothing. */
function ShelfOf<T>({
  id,
  title,
  list,
  items,
  min,
  onOpen,
  render,
}: {
  id: string;
  title: string;
  list: SearchList<unknown>;
  items: readonly T[];
  min?: number;
  onOpen: () => void;
  render: (item: T) => ReactNode;
}) {
  if (!list.pending && items.length === 0 && !list.error) return null;
  return (
    <Shelf
      id={id}
      title={title}
      count={list.total != null ? formatCount(list.total) : null}
      onOpen={onOpen}
    >
      {list.pending ? (
        <TileSkeleton count={6} round={min !== undefined} />
      ) : items.length === 0 ? (
        <StageNote error={list.error} onRetry={list.retry} />
      ) : (
        <TileRow
          items={items}
          label={title}
          {...(min !== undefined ? { min } : {})}
          render={render}
        />
      )}
    </Shelf>
  );
}

/** The end of a paged list: quiet tiles while the next part comes, or why it did not. */
function ListEnd({ list, skeleton }: { list: SearchList<unknown>; skeleton: ReactNode }) {
  const end = useRef<HTMLDivElement>(null);
  useLoadMore(end, list);
  return (
    <>
      {list.loadingMore && <div className="mt-5">{skeleton}</div>}
      {list.error && list.items.length > 0 && (
        <StageNote text="Дальше не загрузилось." error={list.error} onRetry={list.retry} />
      )}
      <div ref={end} aria-hidden="true" />
    </>
  );
}

/** «Треки»: every track found, filters at the left, paged in as you scroll. */
function AllTracks({ query }: { query: string }) {
  const filters = useSearch((s) => s.filters);
  const tracks = useTrackResults(query, filters);
  const filtering = hasFilters(filters);
  const source = { kind: "search", title: query } as const;
  const total = tracks.total;

  return (
    <div className="grid grid-cols-[240px_minmax(0,1fr)] items-start gap-8">
      <FilterColumn
        query={query}
        filters={filters}
        onChange={(next) => useSearch.getState().filter(next)}
      />
      <div className="@container min-w-0">
        <SectionTitle
          id="all-tracks"
          title="Треки"
          count={
            total != null
              ? filtering
                ? `нашлось ${formatCount(total)}`
                : formatCount(total)
              : null
          }
        />
        {tracks.pending ? (
          <RowsSkeleton count={10} />
        ) : tracks.items.length === 0 ? (
          tracks.error ? (
            <StageNote error={tracks.error} onRetry={tracks.retry} />
          ) : (
            <StageNote
              text={
                filtering
                  ? "С такими фильтрами ничего нет. Убери один из них слева."
                  : `Треков по «${query}» нет.`
              }
            />
          )
        ) : (
          <>
            <TrackListHead />
            <TrackRowList
              tracks={tracks.items}
              label="Треки"
              source={source}
              onPlay={(track) => playInOrder(tracks.items, source, track)}
            />
            <ListEnd list={tracks} skeleton={<RowsSkeleton count={4} />} />
          </>
        )}
      </div>
    </div>
  );
}

/** «Люди»: everyone found, as faces. */
function AllPeople({ users }: { users: SearchList<User> }) {
  const open = useOpener();
  if (users.pending) return <TileSkeleton round />;
  if (users.items.length === 0) {
    return users.error ? (
      <StageNote error={users.error} onRetry={users.retry} />
    ) : (
      <StageNote text="Людей с таким именем нет." />
    );
  }
  return (
    <>
      <TileGrid label="Люди">
        {users.items.map((user) => (
          <PersonTile
            key={user.id}
            user={user}
            line={followersLine(user)}
            onOpen={() => open.artist(user)}
          />
        ))}
      </TileGrid>
      <ListEnd list={users} skeleton={<TileSkeleton count={6} round />} />
    </>
  );
}

/** «Плейлисты» and «Альбомы»: everything found, as tiles to open or play. */
function AllCollections({
  me,
  list,
  albums,
}: {
  me: Me;
  list: SearchList<Playlist>;
  albums: boolean;
}) {
  const { play, busyId } = usePlayPlaylist();
  const open = useOpener();
  if (list.pending) return <TileSkeleton />;
  if (list.items.length === 0) {
    return list.error ? (
      <StageNote error={list.error} onRetry={list.retry} />
    ) : (
      <StageNote text={albums ? "Альбомов не нашлось." : "Плейлистов не нашлось."} />
    );
  }
  return (
    <>
      <TileGrid label={albums ? "Альбомы" : "Плейлисты"}>
        {list.items.map((playlist) => (
          <PlaylistTile
            key={playlist.id}
            playlist={playlist}
            line={tileLine(playlist, me)}
            busy={busyId === playlist.id}
            onOpen={() => open.playlist(playlist)}
            onPlay={() => play(playlist)}
          />
        ))}
      </TileGrid>
      <ListEnd list={list} skeleton={<TileSkeleton count={6} />} />
    </>
  );
}
