import {
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import {
  diaryCity,
  diaryClear,
  diaryDays,
  diaryForget,
  diaryKeep,
  diaryPlays,
  diarySettings,
} from "@/api/diary";
import type { DiaryCity, Play } from "@/api/types";
import { onDiaryWritten } from "@/features/diary/record";
import { usePlayer } from "@/features/player/store";
import { actionFailed } from "@/features/problems/watch";
import { actionWords } from "@/features/problems/words";
import { formatCount, plural } from "@/ui/format";

// The diary as the screen reads it. The file is Rust's, on this computer; a
// failed read is a problem like any other («Дневник не загрузился»), and a
// failed change says what did not happen.

/** Plays per page: a few heavy days. */
const PAGE = 300;
/** Days the strip can show. */
const STRIP_DAYS = 62;
/** How long «Вернуть» can take a forgotten play back. */
const UNDO_MS = 7_000;

const records = (n: number) => `${formatCount(n)} ${plural(n, ["запись", "записи", "записей"])}`;

/** Plays newest first, a page at a time; `find` keeps those whose title or artist holds it. */
export function useDiaryPlays(find: string) {
  const query = useInfiniteQuery({
    queryKey: ["diary", "plays", find],
    queryFn: ({ pageParam }) => diaryPlays(pageParam, PAGE, find),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
    // Typing in the find well keeps the last answer on screen until the next one.
    placeholderData: (previous) => previous,
  });
  const forgotten = useForgotten((s) => s.ids);
  const items = useMemo(
    () =>
      (query.data?.pages.flatMap((page) => page.items) ?? []).filter((p) => !forgotten.has(p.id)),
    [query.data, forgotten],
  );
  return {
    items,
    pending: query.isPending,
    error: query.error,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => {
      void query.fetchNextPage();
    },
    /** Loads the next page and says whether there is one after it. */
    loadNext: async () => (await query.fetchNextPage()).hasNextPage,
  };
}

/** How much was played on each of the latest days, for the strip. */
export function useDiaryDays() {
  return useQuery({ queryKey: ["diary", "days"], queryFn: () => diaryDays(STRIP_DAYS) });
}

/** How long the diary keeps, its city or time zone, how much it holds. */
export function useDiarySettings() {
  return useQuery({ queryKey: ["diary", "settings"], queryFn: diarySettings });
}

/** Reads the diary again whenever the player has written to it, at most once a second. */
export function useDiaryLive() {
  const client = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = onDiaryWritten(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void client.invalidateQueries({ queryKey: ["diary"] });
      }, 1_000);
    });
    return () => {
      stop();
      if (timer) clearTimeout(timer);
    };
  }, [client]);
}

const say = (text: string) => usePlayer.getState().say(text);

/** Keeps plays this many days, `null` for always; older ones go at once. */
export function useKeepDays() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (days: number | null) => diaryKeep(days),
    onSuccess: (gone, days) => {
      void client.invalidateQueries({ queryKey: ["diary"] });
      if (gone > 0) say(`Стёр ${records(gone)} старше срока`);
      else if (days === null) say("Дневник хранится всегда");
      else say("Записей старше срока нет: всё на месте");
    },
    onError: (error) =>
      actionFailed(
        "diary-keep",
        actionWords("Срок не поменялся", "Дневник хранит записи по-прежнему.", error),
        error,
      ),
  });
}

/** Names the city the sun is worked out for; `null` goes back to the time zone. */
export function useChooseCity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (city: DiaryCity | null) => diaryCity(city),
    onSuccess: (_done, city) => {
      void client.invalidateQueries({ queryKey: ["diary", "settings"] });
      say(
        city
          ? `Свет и темнота — для города ${city.name}. Уже записанное остаётся как было`
          : "Свет и темнота — снова по часовому поясу",
      );
    },
    onError: (error) =>
      actionFailed(
        "diary-city",
        actionWords("Город не сменился", "Свет и темнота считаются по-прежнему.", error),
        error,
      ),
  });
}

/** Erases every play. */
export function useEraseDiary() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: diaryClear,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["diary"] });
      say("Дневник стёрт. Новые прослушивания будут записываться дальше");
    },
    onError: (error) =>
      actionFailed(
        "diary-erase",
        actionWords("Дневник не стёрся", "Записи остались на месте.", error),
        error,
      ),
  });
}

// --- taking one play out, with «Вернуть» ---------------------------------------------

/** Plays taken out but not yet erased: «Вернуть» can still bring them back. */
const useForgotten = create<{ ids: ReadonlySet<number> }>(() => ({ ids: new Set() }));

const setForgotten = (id: number, gone: boolean) =>
  useForgotten.setState((s) => {
    const ids = new Set(s.ids);
    if (gone) ids.add(id);
    else ids.delete(id);
    return { ids };
  });

/**
 * Takes a play out of the diary at once, and erases it for good once
 * «Вернуть» has had its time: nothing asks first, as with the queue.
 */
export function forgetPlay(play: Play, client: QueryClient) {
  setForgotten(play.id, true);
  const timer = setTimeout(() => {
    diaryForget(play.id)
      .then(() => client.invalidateQueries({ queryKey: ["diary"] }))
      .catch((error: unknown) => {
        setForgotten(play.id, false);
        actionFailed(
          `diary-forget:${play.id}`,
          actionWords("Запись не убралась", `«${play.track.title}» осталась в дневнике.`, error),
          error,
        );
      })
      .finally(() => setForgotten(play.id, false));
  }, UNDO_MS + 500);
  usePlayer.getState().say(`Убрал из дневника: ${play.track.title}`, {
    label: "Вернуть",
    run: () => {
      clearTimeout(timer);
      setForgotten(play.id, false);
    },
  });
}
