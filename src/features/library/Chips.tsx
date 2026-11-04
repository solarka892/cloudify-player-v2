import type { Me } from "@/api/types";
import {
  SECTION_NAMES,
  type SectionId,
  sectionOf,
  useLibraryNav,
  useOpenView,
} from "@/features/library/nav";
import {
  useAllAlbums,
  useAllFollowings,
  useAllLikedPlaylists,
  useAllLikes,
  useAllPlaylists,
  useAllReposts,
} from "@/features/library/queries";
import { formatCount } from "@/ui/format";

const ORDER: SectionId[] = [
  "all",
  "likes",
  "playlists",
  "albums",
  "reposts",
  "followings",
  "stations",
  "history",
];

/** How much each section holds, as each list arrives. Stations and history have no count. */
export function useSectionCounts(me: Me): Partial<Record<SectionId, number | null>> {
  const likes = useAllLikes();
  const own = useAllPlaylists();
  const liked = useAllLikedPlaylists();
  const albums = useAllAlbums();
  const reposts = useAllReposts();
  const followings = useAllFollowings();
  const likedAlbums = liked.items.filter((playlist) => playlist.isAlbum).length;
  return {
    likes: likes.complete ? likes.items.length : me.user.likesCount,
    playlists:
      own.complete && liked.complete
        ? own.items.length + liked.items.length - likedAlbums
        : me.user.playlistCount,
    albums: albums.complete && liked.complete ? albums.items.length + likedAlbums : null,
    reposts: reposts.complete ? reposts.items.length : null,
    followings: followings.complete ? followings.items.length : me.user.followingsCount,
  };
}

/** The library's sections as chips, in the home's mood-chip material; the current one is white. */
export function Chips({ me }: { me: Me }) {
  const view = useLibraryNav((s) => s.view);
  const open = useOpenView();
  const counts = useSectionCounts(me);
  const current = sectionOf(view);

  return (
    <nav aria-label="Разделы библиотеки" className="relative z-10 mt-1 mb-8 flex flex-wrap gap-2">
      {ORDER.map((id) => {
        const count = counts[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => open({ kind: "section", section: id })}
            aria-current={view.kind === "section" && current === id ? "page" : undefined}
            className="flex h-9 items-center gap-1.5 rounded-full bg-[rgb(10_10_12/0.66)] px-[15px] font-bold text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] transition-colors duration-150 hover:text-white aria-[current=page]:bg-white aria-[current=page]:text-ink aria-[current=page]:shadow-none"
          >
            {id === "all" ? "Всё" : SECTION_NAMES[id]}
            {count != null && (
              <span className="font-bold text-[12.5px] tabular-nums opacity-55">
                {formatCount(count)}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
