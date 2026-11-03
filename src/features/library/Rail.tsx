import {
  AudioLines,
  Disc3,
  Heart,
  History,
  type LucideIcon,
  Radio,
  Repeat2,
  Users,
} from "lucide-react";
import type { Me, Playlist } from "@/api/types";
import { type SectionId, sectionOf, useLibraryNav, useOpenView } from "@/features/library/nav";
import {
  useAllAlbums,
  useAllFollowings,
  useAllLikedPlaylists,
  useAllLikes,
  useAllPlaylists,
  useAllReposts,
} from "@/features/library/queries";
import { type QueueSource, usePlayer } from "@/features/player/store";
import { formatCount, plural } from "@/ui/format";
import { Mosaic } from "@/ui/Mosaic";

const TRACKS = ["трек", "трека", "треков"] as const;

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "likes", label: "Лайки", icon: Heart },
  { id: "albums", label: "Альбомы", icon: Disc3 },
  { id: "reposts", label: "Репосты", icon: Repeat2 },
  { id: "followings", label: "Подписки", icon: Users },
  { id: "stations", label: "Станции", icon: Radio },
  { id: "history", label: "История", icon: History },
];

/** Where the music that plays now came from, to mark it in the rail. */
function playingFrom(source: QueueSource | null, playing: boolean) {
  if (!playing || !source) return { section: null, playlist: null };
  if (source.kind === "playlist") return { section: null, playlist: source.id ?? null };
  const section: SectionId | null =
    source.kind === "likes"
      ? "likes"
      : source.kind === "reposts"
        ? "reposts"
        : source.kind === "station"
          ? "stations"
          : null;
  return { section, playlist: null };
}

/**
 * The library's left column: every section, then every playlist by name, so
 * whatever you are after is one click away and the stage shows it. The
 * sections never scroll away; only the playlists do, under them.
 */
export function Rail({ me }: { me: Me }) {
  const view = useLibraryNav((s) => s.view);
  const open = useOpenView();
  const likes = useAllLikes();
  const own = useAllPlaylists();
  const liked = useAllLikedPlaylists();
  const albums = useAllAlbums();
  const reposts = useAllReposts();
  const followings = useAllFollowings();
  const source = usePlayer((s) => s.source);
  const playing = usePlayer((s) => s.playing && s.index >= 0);
  const now = playingFrom(source, playing);

  const section = sectionOf(view);
  const openId = view.kind === "playlist" ? view.playlist.id : null;
  const likedPlaylists = liked.items.filter((playlist) => !playlist.isAlbum);
  const playlists = [...own.items, ...likedPlaylists];
  const playlistCount =
    own.complete && liked.complete ? playlists.length : (me.user.playlistCount ?? null);

  // Counts appear as each list is in. Stations are made by the app and history
  // is a rolling window, so neither has a count worth showing.
  const counts: Partial<Record<SectionId, number | null>> = {
    likes: likes.complete ? likes.items.length : me.user.likesCount,
    albums:
      albums.complete && liked.complete
        ? albums.items.length + liked.items.length - likedPlaylists.length
        : null,
    reposts: reposts.complete ? reposts.items.length : null,
    followings: followings.complete ? followings.items.length : me.user.followingsCount,
  };

  return (
    <aside
      aria-label="Разделы библиотеки"
      className="sticky top-20 z-10 mt-20 flex h-[calc(100dvh-180px)] w-[clamp(208px,18vw,264px)] shrink-0 flex-col rounded-[22px] bg-panel p-2"
    >
      <nav aria-label="Разделы" className="shrink-0">
        <ul>
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const count = counts[id];
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => open({ kind: "section", section: id })}
                  aria-current={section === id ? "page" : undefined}
                  className="flex h-10 w-full items-center gap-3 rounded-xl px-3 font-bold text-[15px] text-fg-muted transition-colors duration-150 hover:bg-white/5 hover:text-fg aria-[current=page]:bg-white/10 aria-[current=page]:text-fg [@media(max-height:700px)]:h-9"
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-left">{label}</span>
                  {now.section === id ? (
                    <AudioLines className="size-4 text-glow-1" aria-label="Играет отсюда" />
                  ) : (
                    count != null && (
                      <span className="font-bold text-[12.5px] text-fg-faint tabular-nums">
                        {formatCount(count)}
                      </span>
                    )
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <button
        type="button"
        onClick={() => open({ kind: "section", section: "playlists" })}
        aria-current={section === "playlists" ? "page" : undefined}
        className="mt-3 flex h-11 w-full shrink-0 items-baseline gap-2.5 rounded-xl px-3 pt-3 text-left transition-colors duration-150 hover:bg-white/5 aria-[current=page]:bg-white/10"
      >
        <span className="font-bold font-display text-[19px] leading-none tracking-[-0.02em]">
          Плейлисты
        </span>
        {playlistCount != null && (
          <span className="font-bold text-[12.5px] text-fg-faint tabular-nums leading-none">
            {formatCount(playlistCount)}
          </span>
        )}
      </button>

      {own.pending && liked.pending ? (
        <ul aria-hidden="true" className="mt-1">
          {["a", "b", "c", "d"].map((key) => (
            <li key={key} className="flex h-12 items-center gap-3 px-2">
              <span className="size-9 rounded-[8px] bg-panel-hover" />
              <span className="h-3 w-24 rounded bg-panel-hover" />
            </li>
          ))}
        </ul>
      ) : (
        // Only this list scrolls; its edges fade instead of cutting a row in half.
        <ul
          aria-label="Плейлисты"
          className="mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pt-1 pb-6 [mask-image:linear-gradient(to_bottom,transparent,black_8px,black_calc(100%-28px),transparent)]"
        >
          {playlists.map((playlist) => (
            <RailPlaylist
              key={playlist.id}
              playlist={playlist}
              line={
                playlist.user && playlist.user.id !== me.user.id
                  ? playlist.user.username
                  : `${formatCount(playlist.trackCount)} ${plural(playlist.trackCount, TRACKS)}`
              }
              current={openId === playlist.id}
              playing={now.playlist === playlist.id}
              onOpen={() => open({ kind: "playlist", playlist, from: null })}
            />
          ))}
          {own.complete && liked.complete && playlists.length === 0 && (
            <li className="px-3 py-2 text-[13px] text-fg-faint">Плейлистов пока нет.</li>
          )}
        </ul>
      )}
    </aside>
  );
}

function RailPlaylist({
  playlist,
  line,
  current,
  playing,
  onOpen,
}: {
  playlist: Playlist;
  line: string;
  current: boolean;
  playing: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={current ? "page" : undefined}
        className="flex h-12 w-full items-center gap-3 rounded-xl px-2 text-left transition-colors duration-150 hover:bg-white/5 aria-[current=page]:bg-white/10"
      >
        <Mosaic playlist={playlist} coverSize={100} className="size-9 shrink-0 rounded-[8px]" />
        <span className="min-w-0 flex-1">
          <b
            className={`block truncate font-bold text-[14px] ${playing ? "text-glow-1" : "text-fg"}`}
          >
            {playlist.title}
          </b>
          <span className="block truncate font-bold text-[12px] text-fg-faint">{line}</span>
        </span>
        {playing && (
          <AudioLines className="size-4 shrink-0 text-glow-1" aria-label="Играет отсюда" />
        )}
      </button>
    </li>
  );
}
