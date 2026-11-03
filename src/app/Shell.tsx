import { useEffect, useRef, useState } from "react";
import type { Me } from "@/api/types";
import { ScrollRoot } from "@/app/scrollRoot";
import { type Tab, TopBar } from "@/app/TopBar";
import { HomePage } from "@/features/home/HomePage";
import { LibraryPage } from "@/features/library/LibraryPage";
import { type SectionId, useLibraryNav } from "@/features/library/nav";
import { useLikesInBackground } from "@/features/library/play";
import { ComingSoon } from "@/features/placeholder/ComingSoon";
import { useCoverGlow } from "@/features/player/coverGlow";
import { startAudioEngine } from "@/features/player/engine";
import { PlayerBar } from "@/features/player/PlayerBar";
import { currentTrack, usePlayer } from "@/features/player/store";
import { moodById } from "@/features/selection/moods";
import { useSelection } from "@/features/selection/useSelection";
import { useSessionExpired } from "@/features/session/useSession";

/** Space plays and pauses, unless it is typing or pressing a button. */
function useSpaceToPlay() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, button, [role='slider'], [contenteditable='true']"))
        return;
      event.preventDefault();
      usePlayer.getState().toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** The signed-in window: the page under the floating top bar, the player at the bottom. */
export function Shell({ me }: { me: Me }) {
  const [tab, setTab] = useState<Tab>("home");
  const [scrolled, setScrolled] = useState(false);
  const page = useRef<HTMLElement>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const sessionExpired = useSessionExpired();

  useEffect(() => setScroller(page.current), []);

  useEffect(
    () => startAudioEngine({ onSessionExpired: () => void sessionExpired() }),
    [sessionExpired],
  );
  useSpaceToPlay();
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
    setTab(next);
    // A section always opens at its top.
    page.current?.scrollTo({ top: 0 });
  };
  const openLibrary = (section: SectionId) => {
    useLibraryNav.getState().open({ kind: "section", section });
    open("library");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <TopBar me={me} tab={tab} onTab={open} scrolled={scrolled} />
        <main
          ref={page}
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 8)}
          className="h-full overflow-y-auto overscroll-contain"
        >
          <ScrollRoot value={scroller}>
            {tab === "home" ? (
              <HomePage me={me} onOpenLibrary={openLibrary} />
            ) : tab === "library" ? (
              <LibraryPage me={me} />
            ) : (
              <ComingSoon page={tab} />
            )}
          </ScrollRoot>
        </main>
      </div>
      <PlayerBar />
    </div>
  );
}
