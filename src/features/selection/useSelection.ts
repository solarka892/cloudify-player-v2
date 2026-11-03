import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { create } from "zustand";
import { trackStation } from "@/api/player";
import type { Track } from "@/api/types";
import { useHistory, useLikes } from "@/features/library/queries";
import { type QueueOptions, usePlayer } from "@/features/player/store";
import { buildQueue, canPlay, type SelectionInput } from "@/features/selection/buildQueue";
import type { MoodId } from "@/features/selection/moods";
import { EARLY_SKIP_SECONDS, rememberSkip, skippedTracks } from "@/features/selection/skipped";

interface SelectionStore {
  mood: MoodId;
  /** One order per run; a refill moves it on. */
  seed: number;
  /** Bumped when a skip is remembered, so the preview leaves that track out. */
  skips: number;
  setMood: (mood: MoodId) => void;
}

export const useSelectionStore = create<SelectionStore>()((set) => ({
  mood: "usual",
  seed: Math.floor(Math.random() * 2 ** 31),
  skips: 0,
  setMood: (mood) => set({ mood }),
}));

const NO_TRACKS: readonly Track[] = [];

export type SelectionStatus = "loading" | "ready" | "empty" | "error";

/**
 * The «Подборка» as the screen needs it: what would play now in the chosen
 * mood, and the actions that start and steer it in the player.
 */
export function useSelection() {
  const mood = useSelectionStore((s) => s.mood);
  const seed = useSelectionStore((s) => s.seed);
  const skips = useSelectionStore((s) => s.skips);
  const likes = useLikes();
  const history = useHistory();

  const likedTracks = useMemo(
    () => likes.data?.items.map((i) => i.track) ?? NO_TRACKS,
    [likes.data],
  );
  const playedTracks = useMemo(
    () => history.data?.items.map((i) => i.track) ?? NO_TRACKS,
    [history.data],
  );
  // The radio starts from what was played last, or else from the latest like.
  const stationSeed = (playedTracks.find(canPlay) ?? likedTracks.find(canPlay))?.id ?? null;
  const station = useQuery({
    queryKey: ["station", stationSeed],
    queryFn: () => trackStation(stationSeed ?? 0),
    enabled: stationSeed !== null,
    staleTime: 30 * 60_000,
  });
  const stationTracks = station.data ?? NO_TRACKS;

  const input = useMemo(
    (): Omit<SelectionInput, "mood" | "seed" | "skipped"> => ({
      likes: likedTracks,
      history: playedTracks,
      station: stationTracks,
    }),
    [likedTracks, playedTracks, stationTracks],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: `skips` is how a remembered skip reaches the preview
  const queue = useMemo(
    () => buildQueue({ ...input, mood, seed, skipped: skippedTracks() }),
    [input, mood, seed, skips],
  );

  // Refills and mood switches run later, from the player; they read the latest input.
  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  }, [input]);

  const options = useCallback(
    (): QueueOptions => ({
      refill: (exclude) => {
        const store = useSelectionStore.getState();
        const nextSeed = (store.seed * 1_103_515_245 + 12_345) >>> 0;
        useSelectionStore.setState({ seed: nextSeed });
        const base = { ...latest.current, mood: store.mood, skipped: skippedTracks() };
        const more = buildQueue({ ...base, seed: nextSeed, exclude });
        // Everything has had a turn: start the round again rather than stop.
        return more.length > 0 ? more : buildQueue({ ...base, seed: nextSeed });
      },
      onSkip: (track, reason, position) => {
        if (reason === "dislike" || (reason === "skip" && position < EARLY_SKIP_SECONDS)) {
          rememberSkip(track.id);
          useSelectionStore.setState((s) => ({ skips: s.skips + 1 }));
        }
      },
    }),
    [],
  );

  const waitingForRadio = mood === "new" && station.isPending && stationSeed !== null;
  let status: SelectionStatus;
  if (likes.isPending || history.isPending || waitingForRadio) status = "loading";
  else if (likes.isError && queue.length === 0) status = "error";
  else status = queue.length > 0 ? "ready" : "empty";

  const start = useCallback(
    (index = 0) => {
      usePlayer.getState().playQueue(queue, index, { kind: "selection" }, options());
    },
    [queue, options],
  );

  /** A new mood: the light changes now; a playing selection keeps its track and changes what follows. */
  const chooseMood = useCallback((next: MoodId) => {
    useSelectionStore.getState().setMood(next);
    const player = usePlayer.getState();
    const current = player.queue[player.index];
    if (player.source?.kind !== "selection" || !current) return;
    const upcoming = buildQueue({
      ...latest.current,
      mood: next,
      seed: useSelectionStore.getState().seed,
      skipped: skippedTracks(),
      exclude: new Set([current.id]),
    });
    if (upcoming.length > 0) player.replaceUpcoming(upcoming);
  }, []);

  return {
    mood,
    status,
    queue,
    preview: queue[0] ?? null,
    error: likes.error,
    retry: () => {
      void likes.refetch();
      void history.refetch();
    },
    start,
    chooseMood,
  };
}
