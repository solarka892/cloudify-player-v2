import type { CSSProperties } from "react";
import type { Me } from "@/api/types";
import { usePointedCover } from "@/features/library/light";
import { type LibraryView, useLibraryNav } from "@/features/library/nav";
import { AlbumsView, PlaylistsView } from "@/features/library/views/CollectionViews";
import { OverviewView } from "@/features/library/views/OverviewView";
import { ArtistView, FollowingsView, StationsView } from "@/features/library/views/PeopleViews";
import { PlaylistView } from "@/features/library/views/PlaylistView";
import { HistoryView, LikesWallView, RepostsView } from "@/features/library/views/WallViews";
import { useCoverColours } from "@/features/player/coverGlow";
import { currentTrack, usePlayer } from "@/features/player/store";
import { useLoudness } from "@/features/player/useLoudness";
import { Ribbon } from "@/ui/Ribbon";

/** The cover an opened playlist or person lends the light; sections keep the room's. */
function openedCover(view: LibraryView): string | null {
  if (view.kind === "playlist") return view.playlist.artworkUrl ?? view.playlist.covers[0] ?? null;
  if (view.kind === "artist") return view.user.avatarUrl;
  return null;
}

/**
 * The light over the library. It swells with the playing track like the home
 * screen's; its colours are the cover you point at on the wall, else the
 * opened playlist's, else the playing cover's, crossing over as they change.
 */
function LibraryLight({ opened }: { opened: string | null }) {
  const pointed = usePointedCover((s) => s.cover);
  const colours = useCoverColours(pointed ?? opened);
  const nowPlaying = usePlayer(currentTrack);
  const playing = usePlayer((s) => s.playing);
  const loudness = useLoudness(nowPlaying);
  const relit = colours
    ? ({
        "--glow-1": colours[0],
        "--glow-2": colours[1],
        "--glow-3": colours[2],
      } as CSSProperties)
    : undefined;

  return (
    <div
      aria-hidden="true"
      className={`grain pointer-events-none absolute inset-x-0 top-0 h-[480px] overflow-clip ${pointed ? "relight-quick" : "relight"}`}
      style={relit}
    >
      <Ribbon
        playing={playing && nowPlaying !== null}
        energy={0.85}
        pace={0.75}
        loudness={loudness}
        className="absolute inset-x-0 top-6 h-[420px] w-full"
      />
    </div>
  );
}

function View({ view, me }: { view: LibraryView; me: Me }) {
  switch (view.kind) {
    case "playlist":
      return (
        <PlaylistView key={view.playlist.id} me={me} playlist={view.playlist} from={view.from} />
      );
    case "artist":
      return <ArtistView key={view.user.id} user={view.user} from={view.from} />;
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
      <LibraryLight opened={openedCover(view)} />
      <div className="@container relative z-10 px-14 pb-12">
        {view.kind === "section" && (
          <h1 className="whitespace-nowrap pt-[clamp(88px,13vh,104px)] pb-6 font-display font-extrabold text-[length:min(108px,12.5cqi)] leading-[0.92] tracking-[-0.055em] [text-shadow:0_10px_50px_rgb(0_0_0/0.35)]">
            Библиотека
          </h1>
        )}
        <View view={view} me={me} />
      </div>
    </div>
  );
}
