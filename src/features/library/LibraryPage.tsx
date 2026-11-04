import type { Me } from "@/api/types";
import { WallSkeleton } from "@/features/library/CoverWall";
import {
  type LibraryView,
  SECTION_NAMES,
  type SectionId,
  useLibraryNav,
  useOpenView,
} from "@/features/library/nav";
import { PageLight } from "@/features/library/PageLight";
import { AlbumsView, PlaylistsView } from "@/features/library/views/CollectionViews";
import { OverviewView } from "@/features/library/views/OverviewView";
import { ArtistView, FollowingsView, StationsView } from "@/features/library/views/PeopleViews";
import { PlaylistView } from "@/features/library/views/PlaylistView";
import { HistoryView, LikesWallView, RepostsView } from "@/features/library/views/WallViews";
import { Part } from "@/features/problems/Part";
import type { Part as Named } from "@/features/problems/words";

/** The cover an opened playlist or person lends the light; sections keep the room's. */
function openedCover(view: LibraryView): string | null {
  if (view.kind === "playlist") return view.playlist.artworkUrl ?? view.playlist.covers[0] ?? null;
  if (view.kind === "artist") return view.user.avatarUrl;
  return null;
}

const viewKey = (view: LibraryView) =>
  view.kind === "section"
    ? view.section
    : `${view.kind}:${view.kind === "playlist" ? view.playlist.id : view.user.id}`;

/** What a view is called when it breaks: «Лайки сломались», «Плейлист сломался». */
function partName(view: LibraryView): Named {
  if (view.kind === "playlist")
    return { name: view.playlist.isAlbum ? "Альбом" : "Плейлист", form: "m" };
  if (view.kind === "artist") return { name: "Страница артиста", form: "f" };
  if (view.section === "all") return { name: "Библиотека", form: "f" };
  if (view.section === "history") return { name: "История", form: "f" };
  return { name: SECTION_NAMES[view.section], form: "pl" };
}

function View({ view, me }: { view: LibraryView; me: Me }) {
  const open = useOpenView();
  const back = (from: SectionId) => ({
    label: SECTION_NAMES[from],
    onClick: () => open({ kind: "section", section: from }),
  });
  switch (view.kind) {
    case "playlist":
      return (
        <PlaylistView
          key={view.playlist.id}
          me={me}
          playlist={view.playlist}
          back={back(view.from)}
        />
      );
    case "artist":
      return <ArtistView key={view.user.id} user={view.user} back={back(view.from)} />;
    case "section":
      switch (view.section) {
        case "all":
          return <OverviewView me={me} />;
        case "likes":
          return <LikesWallView me={me} />;
        case "playlists":
          return <PlaylistsView me={me} />;
        case "albums":
          return <AlbumsView me={me} />;
        case "reposts":
          return <RepostsView me={me} />;
        case "followings":
          return <FollowingsView me={me} />;
        case "stations":
          return <StationsView me={me} />;
        case "history":
          return <HistoryView me={me} />;
      }
  }
}

/**
 * «Библиотека»: one big word on the light, the white «Перемешать все» and the
 * filter, the sections as chips, then one row of each section — and each
 * section in full as a wall of its covers.
 */
export function LibraryPage({ me }: { me: Me }) {
  const view = useLibraryNav((s) => s.view);
  return (
    // The ground behind the light is what its grain blends into; without it the grain shows as haze.
    <div className="relative isolate min-h-full bg-ground">
      <PageLight cover={openedCover(view)} />
      <div className="@container relative z-10 px-14 pb-12">
        {view.kind === "section" && (
          <h1 className="whitespace-nowrap pt-[clamp(88px,13vh,104px)] pb-6 font-display font-extrabold text-[length:min(108px,12.5cqi)] leading-[0.92] tracking-[-0.055em] [text-shadow:0_10px_50px_rgb(0_0_0/0.35)]">
            Библиотека
          </h1>
        )}
        <Part key={viewKey(view)} name={partName(view)} frames={<WallSkeleton />}>
          <View view={view} me={me} />
        </Part>
      </div>
    </div>
  );
}
