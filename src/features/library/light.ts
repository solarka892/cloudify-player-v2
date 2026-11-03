import { useCallback, useEffect, useRef } from "react";
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

/**
 * Pointing for a group of covers: a brief rest before the light follows, so
 * sweeping across them does not flicker it, and nothing left pointed when the
 * group goes away.
 */
export function usePointing(): (cover: string | null) => void {
  const point = usePointedCover((s) => s.point);
  const pause = useRef(0);
  useEffect(
    () => () => {
      window.clearTimeout(pause.current);
      point(null);
    },
    [point],
  );
  return useCallback(
    (cover: string | null) => {
      window.clearTimeout(pause.current);
      pause.current = window.setTimeout(() => point(cover), cover ? 70 : 0);
    },
    [point],
  );
}

/** Mouse or keyboard leaving a group of covers gives the light back. */
export function leavesGroup(event: { currentTarget: Element; relatedTarget: EventTarget | null }) {
  return !(
    event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)
  );
}
