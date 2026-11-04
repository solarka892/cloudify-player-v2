import { create } from "zustand";

/**
 * What floats over the window from the player: the queue sheet, the key help
 * and the selection's desk. The queue and the desk take turns; the key help
 * covers both while it is open, and they come back after.
 */
interface Panels {
  queue: boolean;
  keys: boolean;
  desk: boolean;
  /** Opens or closes the queue; without an argument, flips it. */
  showQueue: (open?: boolean) => void;
  /** Opens or closes the key help; without an argument, flips it. */
  showKeys: (open?: boolean) => void;
  /** Opens or closes «Настроить подборку»; without an argument, flips it. */
  showDesk: (open?: boolean) => void;
}

export const usePanels = create<Panels>()((set) => ({
  queue: false,
  keys: false,
  desk: false,
  showQueue: (open) =>
    set((s) => {
      const queue = open ?? !s.queue;
      return { queue, desk: queue ? false : s.desk };
    }),
  showKeys: (open) => set((s) => ({ keys: open ?? !s.keys })),
  showDesk: (open) =>
    set((s) => {
      const desk = open ?? !s.desk;
      return { desk, queue: desk ? false : s.queue };
    }),
}));
