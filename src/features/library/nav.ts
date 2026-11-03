import { useCallback } from "react";
import { create } from "zustand";
import type { Playlist, User } from "@/api/types";
import { useScrollRoot } from "@/app/scrollRoot";

export type SectionId =
  | "likes"
  | "playlists"
  | "albums"
  | "reposts"
  | "followings"
  | "stations"
  | "history";

/**
 * What the library's stage shows: a section, or one thing opened from it. An
 * opened thing carries what is already known about it, so its name and cover
 * are on stage before the rest arrives.
 */
export type LibraryView =
  | { kind: "section"; section: SectionId }
  | { kind: "playlist"; playlist: Playlist; from: SectionId | null }
  | { kind: "artist"; user: User; from: SectionId | null };

interface LibraryNav {
  view: LibraryView;
  open: (view: LibraryView) => void;
}

/** Kept outside the page, so the library is where you left it when you come back. */
export const useLibraryNav = create<LibraryNav>()((set) => ({
  view: { kind: "section", section: "likes" },
  open: (view) => set({ view }),
}));

/** Opens a view on the stage, from its top. */
export function useOpenView(): (view: LibraryView) => void {
  const scroller = useScrollRoot();
  return useCallback(
    (view: LibraryView) => {
      useLibraryNav.getState().open(view);
      scroller?.scrollTo({ top: 0 });
    },
    [scroller],
  );
}

/** The section a view belongs to: its own, or the one it was opened from. */
export function sectionOf(view: LibraryView): SectionId | null {
  return view.kind === "section" ? view.section : view.from;
}
