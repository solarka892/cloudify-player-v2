import type { CSSProperties } from "react";
import type { Me } from "@/api/types";
import { type LibraryView, useLibraryNav } from "@/features/library/nav";
import { Rail } from "@/features/library/Rail";
import { AlbumsView, PlaylistsView } from "@/features/library/views/CollectionViews";
import { HistoryView } from "@/features/library/views/HistoryView";
import { LikesView } from "@/features/library/views/LikesView";
import { ArtistView, FollowingsView, StationsView } from "@/features/library/views/PeopleViews";
import { PlaylistView } from "@/features/library/views/PlaylistView";
import { RepostsView } from "@/features/library/views/RepostsView";
import { useCoverColours } from "@/features/player/coverGlow";
import { currentTrack, usePlayer } from "@/features/player/store";
import { useLoudness } from "@/features/player/useLoudness";
import { Ribbon } from "@/ui/Ribbon";

/** The cover whose colours light the stage: the opened playlist's or person's; sections keep the room's. */
function stageCover(view: LibraryView): string | null {
  if (view.kind === "playlist") return view.playlist.artworkUrl ?? view.playlist.covers[0] ?? null;
  if (view.kind === "artist") return view.user.avatarUrl;
  return null;
}

/**
 * The light over the library. It swells with the playing track like the home
 * screen's, but takes the colours of whatever the stage has open, crossing
 * over to them in the same 1.6 s the whole app uses.
 */
function StageLight({ cover }: { cover: string | null }) {
  const colours = useCoverColours(cover);
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
      className="grain relight pointer-events-none absolute inset-x-0 top-0 h-[480px] overflow-clip"
      style={relit}
    >
      <Ribbon
        playing={playing && nowPlaying !== null}
        energy={0.8}
        pace={0.75}
        loudness={loudness}
        className="absolute inset-x-0 top-4 h-[420px] w-full opacity-90"
      />
    </div>
  );
}

function Stage({ view, me }: { view: LibraryView; me: Me }) {
  switch (view.kind) {
    case "playlist":
      return (
        <PlaylistView key={view.playlist.id} me={me} playlist={view.playlist} from={view.from} />
      );
    case "artist":
      return <ArtistView key={view.user.id} user={view.user} from={view.from} />;
    case "section":
      switch (view.section) {
        case "likes":
          return <LikesView me={me} />;
        case "playlists":
          return <PlaylistsView me={me} />;
        case "albums":
          return <AlbumsView me={me} />;
        case "reposts":
          return <RepostsView me={me} />;
        case "followings":
          return <FollowingsView me={me} />;
        case "stations":
          return <StationsView />;
        case "history":
          return <HistoryView />;
      }
  }
}

/** «Библиотека»: the rail with every section and playlist, and the stage with what is open. */
export function LibraryPage({ me }: { me: Me }) {
  const view = useLibraryNav((s) => s.view);
  return (
    // The ground behind the light is what its grain blends into; without it the grain shows as haze.
    <div className="relative isolate min-h-full bg-ground">
      <StageLight cover={stageCover(view)} />
      <div className="relative z-10 flex items-start gap-8 px-14 pb-12">
        <Rail me={me} />
        <div className="@container min-w-0 flex-1">
          <Stage view={view} me={me} />
        </div>
      </div>
    </div>
  );
}
