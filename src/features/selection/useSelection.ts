import { type UseQueryResult, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { create } from "zustand";
import { diaryTaste } from "@/api/diary";
import { relatedTracks, trackStation } from "@/api/player";
import type { DiaryTaste, Track } from "@/api/types";
import { onDiaryWritten } from "@/features/diary/record";
import { useAllLikes, useLikes, useRecentPlays } from "@/features/library/queries";
import {
  canPlay,
  LEARNING_PLAYS,
  type Pool,
  type Seed,
  type Selection,
  type SourceId,
  tracksOf,
} from "@/features/selection/engine";
import type { MoodId } from "@/features/selection/moods";
import {
  build,
  chooseMood,
  LIST_STALE_MS,
  provide,
  start,
  useSelectionSession,
} from "@/features/selection/session";
import { useSelectionSettings } from "@/features/selection/settings";
import { learn } from "@/features/selection/taste";

// «Подборка» as the screens need it. The shell gathers what it is made from —
// your likes, SoundCloud's history, the listening diary, radios and related
// tracks grown from what you heard to the end — once, and every screen reads
// the same answer: what would play now, and how much it has learned.

const NO_TRACKS: readonly Track[] = [];
const NO_POOLS: readonly Pool[] = [];
/** Radios and related lists grow from this many tracks heard to the end lately. */
const SEEDS = 3;
/** The diary is read again at most this often while music plays. */
const TASTE_EVERY_MS = 20_000;

export type SelectionStatus = "loading" | "ready" | "empty" | "error";

/** What the diary means to the selection right now. */
export type Learning =
  /** Nothing in the diary yet: the rules it starts with. */
  | "rules"
  /** Some plays: it leans on them a little. */
  | "learning"
  /** Enough plays that what it learned has most of the say. */
  | "learned"
  /** The diary cannot be read: the rules, until it can. */
  | "unreadable";

interface Feed {
  status: SelectionStatus;
  error: unknown;
  preview: Selection | null;
  /** Plays the diary has taught it from. */
  plays: number;
  learning: Learning;
  /** The diary reaches back to: when last winter and a year ago will have something. */
  since: number | null;
  windows: { winter: { from: number; to: number }; yearAgo: { from: number; to: number } } | null;
  retry: () => void;
}

const useFeed = create<Feed>()(() => ({
  status: "loading",
  error: null,
  preview: null,
  plays: 0,
  learning: "rules",
  since: null,
  windows: null,
  retry: () => {},
}));

/** A few lists' answers, in order; the same array while none of them changes. */
const answersOf = (results: UseQueryResult<Track[]>[]) => ({
  lists: results.map((result) => result.data),
  pending: results.length > 0 && results.every((result) => result.isPending),
});

/** Where the radios and related lists grow from: what you heard to the end lately, else what played last. */
function seedsOf(
  taste: DiaryTaste | undefined,
  history: readonly Track[],
  likes: readonly Track[],
): { stations: Seed[]; related: Seed[] } {
  const finished = (taste?.finished ?? [])
    .filter((f) => canPlay(f.track))
    .slice(0, SEEDS)
    .map((f): Seed => ({ track: f.track, reason: "finished", at: f.at }));
  if (finished.length > 0) return { stations: finished, related: finished };
  // Nothing heard out yet: the radio grows from what played last, as it always did.
  const played = history.find(canPlay);
  if (played) return { stations: [{ track: played, reason: "played", at: null }], related: [] };
  const liked = likes.find(canPlay);
  return { stations: liked ? [{ track: liked, reason: "liked", at: null }] : [], related: [] };
}

/**
 * Gathers what the selection is made from and keeps the answer current. The
 * shell calls it once; screens read it with {@link useSelection}.
 */
export function useSelectionFeed() {
  const client = useQueryClient();
  const firstLikes = useLikes();
  const allLikes = useAllLikes();
  const history = useRecentPlays();
  const taste = useQuery({
    queryKey: ["selection", "taste"],
    queryFn: diaryTaste,
    staleTime: TASTE_EVERY_MS,
    retry: false,
  });

  // What the player writes to the diary reaches the selection, a little later.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = onDiaryWritten(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void client.invalidateQueries({ queryKey: ["selection", "taste"] });
      }, TASTE_EVERY_MS);
    });
    return () => {
      stop();
      if (timer) clearTimeout(timer);
    };
  }, [client]);

  // All your likes once they are in; the latest two hundred until then.
  const likes = useMemo(() => {
    if (allLikes.complete) return allLikes.items.map((item) => item.track);
    return firstLikes.data?.items.map((item) => item.track) ?? NO_TRACKS;
  }, [allLikes.complete, allLikes.items, firstLikes.data]);
  const played = useMemo(() => history.items.map((item) => item.track), [history.items]);

  const seeds = useMemo(() => seedsOf(taste.data, played, likes), [taste.data, played, likes]);
  const stations = useQueries({
    queries: seeds.stations.map((seed) => ({
      queryKey: ["station", seed.track.id],
      queryFn: () => trackStation(seed.track.id),
      staleTime: LIST_STALE_MS,
    })),
    combine: answersOf,
  });
  const related = useQueries({
    queries: seeds.related.map((seed) => ({
      queryKey: ["related", seed.track.id],
      queryFn: () => relatedTracks(seed.track.id),
      staleTime: LIST_STALE_MS,
    })),
    combine: answersOf,
  });

  const pools = useMemo((): readonly Pool[] => {
    const out: Pool[] = [];
    seeds.stations.forEach((seed, i) => {
      const tracks = stations.lists[i];
      if (tracks) out.push({ source: "stations", seed, tracks });
    });
    seeds.related.forEach((seed, i) => {
      const tracks = related.lists[i];
      if (tracks) out.push({ source: "related", seed, tracks });
    });
    const diary = taste.data;
    out.push({
      source: "history",
      tracks: diary ? [...played, ...diary.kept] : played,
    });
    if (diary) {
      out.push({
        source: "winter",
        tracks: diary.winter.tracks.map((t) => t.track),
        heard: new Map(diary.winter.tracks.map((t) => [t.track.id, t.times])),
      });
      out.push({
        source: "yearAgo",
        tracks: diary.yearAgo.tracks.map((t) => t.track),
        heard: new Map(diary.yearAgo.tracks.map((t) => [t.track.id, t.times])),
      });
    }
    return out.length > 0 ? out : NO_POOLS;
  }, [seeds, played, taste.data, stations.lists, related.lists]);

  const learned = useMemo(
    () => (taste.data ? learn(taste.data.plays, Date.now()) : null),
    [taste.data],
  );

  useEffect(() => {
    provide({ likes, history: played, pools, taste: learned });
  }, [likes, played, pools, learned]);

  // What would play now: rebuilt when the library, the diary, the mood or a setting changes.
  const base = useSelectionSession((s) => s.base);
  const mood = useSelectionSession((s) => s.mood);
  const seed = useSelectionSession((s) => s.seed);
  const steers = useSelectionSession((s) => s.steers);
  const extra = useSelectionSession((s) => s.extra);
  const skips = useSelectionSession((s) => s.skips);
  const settings = useSelectionSettings((s) => s.settings);
  // biome-ignore lint/correctness/useExhaustiveDependencies: each of these changes what would play
  const preview = useMemo(
    () => (base ? build({}) : null),
    [base, mood, seed, steers, extra, skips, settings],
  );

  const pending = firstLikes.isPending || history.pending || taste.isPending;
  const waitingForRadio = mood === "new" && stations.pending;
  const queue = preview?.picks.length ?? 0;
  let status: SelectionStatus;
  if (pending || waitingForRadio) status = "loading";
  else if (firstLikes.isError && queue === 0) status = "error";
  else status = queue > 0 ? "ready" : "empty";

  const plays = learned?.plays ?? 0;
  const learning: Learning = taste.isError
    ? "unreadable"
    : plays === 0
      ? "rules"
      : plays < LEARNING_PLAYS
        ? "learning"
        : "learned";
  const diary = taste.data;
  // «Повторить» asks the lists that failed again; the store keeps one function that reads the latest.
  const again = useRef(() => {});
  again.current = () => {
    void firstLikes.refetch();
    history.retry();
  };

  useEffect(() => {
    useFeed.setState({
      status,
      error: firstLikes.error,
      preview,
      plays,
      learning,
      since: diary?.since ?? null,
      windows: diary
        ? {
            winter: { from: diary.winter.from, to: diary.winter.to },
            yearAgo: { from: diary.yearAgo.from, to: diary.yearAgo.to },
          }
        : null,
    });
  }, [status, firstLikes.error, preview, plays, learning, diary]);
  useEffect(() => {
    useFeed.setState({ retry: () => again.current() });
  }, []);
}

export interface SourceView {
  id: SourceId;
  /** Candidates it offers now, and how many of them are in the queue. */
  offered: number;
  picked: number;
}

/** The «Подборка» as the screen needs it: what would play now, and the actions that start and steer it. */
export function useSelection() {
  const feed = useFeed();
  const mood = useSelectionSession((s) => s.mood);
  const queue = useMemo(() => (feed.preview ? tracksOf(feed.preview) : NO_TRACKS), [feed.preview]);
  return {
    mood,
    status: feed.status,
    queue,
    preview: queue[0] ?? null,
    error: feed.error,
    retry: feed.retry,
    /** How much of the score is learned (0 … almost 1). */
    learned: feed.preview?.learned ?? 0,
    plays: feed.plays,
    learning: feed.learning,
    since: feed.since,
    windows: feed.windows,
    sources: feed.preview?.sources ?? null,
    start: (index = 0) => {
      if (feed.preview) start(feed.preview, index);
    },
    chooseMood: (next: MoodId) => chooseMood(next),
  };
}

/** Why the selection picked this track, if it did. */
export function usePickOf(trackId: number | null) {
  return useSelectionSession((s) => (trackId === null ? null : (s.picks.get(trackId) ?? null)));
}
