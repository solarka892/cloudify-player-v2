import { create } from "zustand";

/** What floats over the window from the player: the queue sheet and the key help. */
interface Panels {
  queue: boolean;
  keys: boolean;
  /** Opens or closes the queue; without an argument, flips it. */
  showQueue: (open?: boolean) => void;
  /** Opens or closes the key help; without an argument, flips it. */
  showKeys: (open?: boolean) => void;
}

export const usePanels = create<Panels>()((set) => ({
  queue: false,
  keys: false,
  showQueue: (open) => set((s) => ({ queue: open ?? !s.queue })),
  showKeys: (open) => set((s) => ({ keys: open ?? !s.keys })),
}));
