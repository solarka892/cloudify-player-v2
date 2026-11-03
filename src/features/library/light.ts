import { create } from "zustand";

/**
 * The cover the pointer rests on in the library. It lends its colours to the
 * light at the top of the page; kept apart so pointing never re-renders a wall.
 */
export const usePointedCover = create<{
  cover: string | null;
  point: (cover: string | null) => void;
}>()((set) => ({
  cover: null,
  point: (cover) => set((state) => (state.cover === cover ? state : { cover })),
}));
