import { create } from "zustand";
import type { Playlist, TrackFilters, User } from "@/api/types";
import { cleanFilters } from "@/features/search/filters";
import { loadRecent, remember, saveRecent } from "@/features/search/recent";

/** What the results show: a bit of everything, or one kind in full. */
export type Category = "all" | "tracks" | "users" | "playlists" | "albums";

/** Something opened from the results; it takes their place until «Поиск» brings them back. */
export type Opened = { kind: "artist"; user: User } | { kind: "playlist"; playlist: Playlist };

interface SearchState {
  /** What was searched; `null` while the search page is closed. */
  query: string | null;
  category: Category;
  /** Narrow the tracks only; a new search starts without them. */
  filters: TrackFilters;
  opened: Opened | null;
  /** Searches made lately, newest first. */
  recent: string[];
  run: (query: string) => void;
  close: () => void;
  show: (category: Category) => void;
  filter: (filters: TrackFilters) => void;
  open: (item: Opened) => void;
  back: () => void;
  /** Forgets one recent search, or all of them. */
  forget: (query?: string) => void;
}

/** Kept outside the page, so the search is where you left it while you listen. */
export const useSearch = create<SearchState>()((set, get) => ({
  query: null,
  category: "all",
  filters: {},
  opened: null,
  recent: loadRecent(),
  run: (text) => {
    const query = text.trim().replace(/\s+/g, " ");
    if (!query) return;
    const recent = remember(get().recent, query);
    saveRecent(recent);
    set({ query, category: "all", filters: {}, opened: null, recent });
  },
  close: () => set({ query: null, opened: null }),
  show: (category) => set({ category, opened: null }),
  filter: (filters) => set({ filters: cleanFilters(filters), category: "tracks" }),
  open: (opened) => set({ opened }),
  back: () => set({ opened: null }),
  forget: (query) => {
    const recent = query === undefined ? [] : get().recent.filter((old) => old !== query);
    saveRecent(recent);
    set({ recent });
  },
}));
