import { useEffect, useMemo, useRef, useState } from "react";
import type { Me } from "@/api/types";
import { queryClient } from "@/app/queryClient";
import { ScrollRoot } from "@/app/scrollRoot";
import { type Tab, TopBar } from "@/app/TopBar";
import { HomePage } from "@/features/home/HomePage";
import { WallSkeleton } from "@/features/library/CoverWall";
import { LibraryPage } from "@/features/library/LibraryPage";
import {
  type Opener,
  OpenerContext,
  type SectionId,
  sectionOf,
  useLibraryNav,
} from "@/features/library/nav";
import { useLikesInBackground } from "@/features/library/play";
import { ComingSoon } from "@/features/placeholder/ComingSoon";
import { useCoverGlow } from "@/features/player/coverGlow";
import { startAudioEngine } from "@/features/player/engine";
import { useHotkeys } from "@/features/player/hotkeys";
import { KeysHelp } from "@/features/player/KeysHelp";
import { PlayerBar } from "@/features/player/PlayerBar";
import { QueueSheet } from "@/features/player/QueueSheet";
import { currentTrack, usePlayer } from "@/features/player/store";
import { Part } from "@/features/problems/Part";
import { useLightsOut } from "@/features/problems/store";
import { watchConnection } from "@/features/problems/watch";
import type { Part as Named } from "@/features/problems/words";
import { SearchPage } from "@/features/search/SearchPage";
import { type Opened, useSearch } from "@/features/search/store";
import { moodById } from "@/features/selection/moods";
import { useSelection } from "@/features/selection/useSelection";

const PAGE: Named = { name: "Страница", form: "f" };
const PLAYER: Named = { name: "Плеер", form: "m" };
const QUEUE: Named = { name: "Очередь", form: "f" };
const KEYS: Named = { name: "Справка по клавишам", form: "f" };

/** A page's shape while it cannot show itself: where the light and the covers would be. */
function PageFrames() {
  return (
    <div className="px-14 pt-[164px] pb-14">
      <WallSkeleton count={12} />
    </div>
  );
}

/** The signed-in window: the page under the floating top bar, the player at the bottom. */
export function Shell({ me }: { me: Me }) {
  const [tab, setTab] = useState<Tab>("home");
  const [scrolled, setScrolled] = useState(false);
  const page = useRef<HTMLElement>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const searching = useSearch((s) => s.query !== null);
  const lightsOut = useLightsOut();

  useEffect(() => setScroller(page.current), []);

  useEffect(() => startAudioEngine(), []);
  // A lost network is watched for its return; what could not load then loads by itself.
  useEffect(() => watchConnection(queryClient), []);
  // Space, the arrows, M, S, R, Q and ? — the same everywhere in the window.
  useHotkeys();
  // Every like, loading from the start: the library and its shuffle need all of them.
  useLikesInBackground();

  // The light takes its colours from what plays, or from what the selection would play.
  const selection = useSelection();
  const playing = usePlayer(currentTrack);
  const fromSelection = usePlayer((s) => s.source === null || s.source.kind === "selection");
  const glowTrack = playing ?? selection.preview;
  useCoverGlow(
    glowTrack?.artworkUrl ?? null,
    fromSelection ? moodById(selection.mood).light.hueShift : 0,
  );

  const open = (next: Tab) => {
    // A tab leaves the search; the field's recent searches bring it back.
    useSearch.getState().close();
    setTab(next);
    // A section always opens at its top.
    page.current?.scrollTo({ top: 0 });
  };
  const openLibrary = (section: SectionId) => {
    useLibraryNav.getState().open({ kind: "section", section });
    open("library");
  };

  /**
   * An artist's or a playlist's page, from anywhere — a name in the player, on
   * the home screen, on a tile: in place of the results while searching (and
   * «Поиск» brings them back), else in the library, from its open section.
   */
  const opener = useMemo<Opener>(() => {
    const show = (item: Opened) => {
      const search = useSearch.getState();
      if (search.query !== null) {
        search.open(item);
        return;
      }
      const nav = useLibraryNav.getState();
      const from = sectionOf(nav.view);
      nav.open(
        item.kind === "artist"
          ? { kind: "artist", user: item.user, from }
          : { kind: "playlist", playlist: item.playlist, from },
      );
      setTab("library");
      page.current?.scrollTo({ top: 0 });
    };
    return {
      artist: (user) => show({ kind: "artist", user }),
      playlist: (playlist) => show({ kind: "playlist", playlist }),
    };
  }, []);

  return (
    <OpenerContext value={opener}>
      <div data-light={lightsOut ? "out" : undefined} className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1">
          <TopBar me={me} tab={searching ? null : tab} onTab={open} scrolled={scrolled} />
          <main
            ref={page}
            onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 8)}
            className="h-full overflow-y-auto overscroll-contain"
          >
            <ScrollRoot value={scroller}>
              {/* A page that breaks is only that page: another tab opens it afresh. */}
              <Part key={searching ? "search" : tab} name={PAGE} frames={<PageFrames />}>
                {searching ? (
                  <SearchPage me={me} />
                ) : tab === "home" ? (
                  <HomePage me={me} onOpenLibrary={openLibrary} />
                ) : tab === "library" ? (
                  <LibraryPage me={me} />
                ) : (
                  <ComingSoon page={tab} />
                )}
              </Part>
            </ScrollRoot>
          </main>
        </div>
        <Part
          name={PLAYER}
          frames={<div className="h-[84px] shrink-0 border-line border-t bg-dock" />}
        >
          <PlayerBar />
        </Part>
        <Part name={QUEUE} frames={null}>
          <QueueSheet />
        </Part>
        <Part name={KEYS} frames={null}>
          <KeysHelp />
        </Part>
      </div>
    </OpenerContext>
  );
}
