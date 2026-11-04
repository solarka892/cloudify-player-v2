import { create } from "zustand";
import type { ApiError } from "@/api/invoke";

/**
 * What can go wrong: a part SoundCloud did not give (`load`), something the
 * person did that did not happen (`action`), a part of the window that could
 * not show itself (`crash`), the sign-in SoundCloud stopped taking (`session`).
 */
export type ProblemKind = "load" | "action" | "crash" | "session";

export interface Problem {
  /** One id per thing that can break: failing again replaces the old problem. */
  id: string;
  kind: ProblemKind;
  title: string;
  /** Why, and what happens next. */
  text: string;
  /** A few words for the status button. */
  short: string;
  error: ApiError;
  /** The error as the failing code threw it: a part of the page finds its problem by it. */
  cause: unknown;
  at: number;
  resolvedAt: number | null;
  /** Asks again; only where asking again can help now. */
  retry?: (() => void) | undefined;
  /** Shows a broken part afresh. */
  restart?: (() => void) | undefined;
  /** SoundCloud asked to wait until then; it is asked again by itself. */
  waitUntil?: number | undefined;
  /** For a crash: where in the interface it happened. */
  stack?: string | undefined;
}

/** Solved problems are kept a while, so «Уже прошло» can say what happened. */
const KEEP_SOLVED = 12;

interface ProblemsState {
  /** Newest first. */
  list: Problem[];
  /** «Что не так» is open… */
  open: boolean;
  /** …at this problem, when one asked for it. */
  focus: string | null;
  /** Counts things that did not happen, so the status button can catch the eye. */
  pings: number;
  add: (problem: Omit<Problem, "at" | "resolvedAt">) => void;
  resolve: (id: string) => void;
  /** Opens «Что не так», at one problem if given. */
  show: (id?: string | null) => void;
  hide: () => void;
}

export const useProblems = create<ProblemsState>()((set) => ({
  list: [],
  open: false,
  focus: null,
  pings: 0,
  add: (problem) =>
    set((s) => {
      const fresh: Problem = { ...problem, at: Date.now(), resolvedAt: null };
      const others = s.list.filter((p) => p.id !== problem.id);
      const solved = others.filter((p) => p.resolvedAt !== null).slice(KEEP_SOLVED);
      return {
        list: [fresh, ...others.filter((p) => !solved.includes(p))],
        pings: problem.kind === "action" ? s.pings + 1 : s.pings,
      };
    }),
  resolve: (id) =>
    set((s) =>
      s.list.some((p) => p.id === id && p.resolvedAt === null)
        ? {
            list: s.list.map((p) =>
              p.id === id && p.resolvedAt === null ? { ...p, resolvedAt: Date.now() } : p,
            ),
          }
        : s,
    ),
  show: (id = null) => set({ open: true, focus: id }),
  hide: () => set({ open: false, focus: null }),
}));

export const isActive = (problem: Problem) => problem.resolvedAt === null;

/** Problems that read the same, shown as one. */
export interface Group {
  lead: Problem;
  ids: string[];
  /** Asks again for every one of them. */
  retry?: (() => void) | undefined;
}

/**
 * Problems as a person reads them: two lists that failed the same way (the
 * home's few playlists and the library's all of them) are one line, and asking
 * again asks for both.
 */
export function grouped(problems: readonly Problem[]): Group[] {
  const groups = new Map<string, Group>();
  for (const problem of problems) {
    const key = `${problem.kind}|${problem.title}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { lead: problem, ids: [problem.id], retry: problem.retry });
      continue;
    }
    group.ids.push(problem.id);
    const before = group.retry;
    const also = problem.retry;
    if (also)
      group.retry = before
        ? () => {
            before();
            also();
          }
        : also;
  }
  return [...groups.values()];
}

interface ConnectionState {
  /** SoundCloud could not be reached: a request failed for want of a network. */
  offline: boolean;
  /** When the network came back, for «Сеть вернулась». */
  backAt: number | null;
  /** SoundCloud stopped taking the sign-in; the window stays and asks for it again. */
  expired: boolean;
  /** The «Вход устарел» sheet is open. */
  asking: boolean;
  lost: () => void;
  found: () => void;
  expire: () => void;
  renewed: () => void;
  ask: (open: boolean) => void;
}

/** Whether SoundCloud can be reached and still takes the sign-in. */
export const useConnection = create<ConnectionState>()((set, get) => ({
  offline: false,
  backAt: null,
  expired: false,
  asking: false,
  lost: () => {
    if (!get().offline) set({ offline: true });
  },
  found: () => {
    if (get().offline) set({ offline: false, backAt: Date.now() });
  },
  // The sheet opens once, when it happens; later only the status button asks.
  expire: () => {
    if (!get().expired) set({ expired: true, asking: true });
  },
  renewed: () => set({ expired: false, asking: false }),
  ask: (asking) => set({ asking }),
}));

/** The light goes grey while SoundCloud cannot be reached or will not take the sign-in. */
export const useLightsOut = () => useConnection((s) => s.offline || s.expired);
