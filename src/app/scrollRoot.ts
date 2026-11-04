import { createContext, useContext } from "react";

/**
 * The element the page scrolls in (the shell's `<main>`, not the window): long
 * lists window their rows against it, and sticky parts stick inside it.
 */
export const ScrollRoot = createContext<HTMLElement | null>(null);

export function useScrollRoot(): HTMLElement | null {
  return useContext(ScrollRoot);
}
