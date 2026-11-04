import { fold } from "@/features/library/filter";

// The searches made lately, offered in the empty field. They stay on this
// computer (localStorage), like everything else the app remembers.

const KEY = "cloudify.search.recent";
const MAX = 8;

/** `query` first, without an older copy of it (case and spacing aside), at most eight. */
export function remember(recent: readonly string[], query: string): string[] {
  const text = query.trim().replace(/\s+/g, " ");
  if (!text) return [...recent];
  const same = fold(text);
  return [text, ...recent.filter((old) => fold(old) !== same)].slice(0, MAX);
}

export function loadRecent(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === "string").slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

export function saveRecent(recent: readonly string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(recent));
  } catch {
    // Storage can be full or blocked; the list then lives until the app closes.
  }
}
