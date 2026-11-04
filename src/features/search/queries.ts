import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  searchAlbums,
  searchAll,
  searchPlaylists,
  searchSuggestions,
  searchTrackGenres,
  searchTracks,
  searchUsers,
} from "@/api/search";
import type { SearchPage, TrackFilters } from "@/api/types";
import { cleanFilters } from "@/features/search/filters";

// Search results, cached by TanStack Query. «Всё» shows the first page of each
// kind, and a kind opened in full keeps paging the very same list, so nothing
// is asked twice.

/** A page of tracks: enough to play straight away and to fill a few screens. */
const TRACK_PAGE = 40;
const TILE_PAGE = 30;

/** One kind of result as far as it has been paged in, and what is left. */
export interface SearchList<T> {
  items: T[];
  /** SoundCloud's estimate of all matches; `null` until the first page is in. */
  total: number | null;
  pending: boolean;
  error: unknown;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

function useSearchList<T extends { id: number }>(
  key: readonly unknown[],
  fetchPage: (offset: number, limit: number) => Promise<SearchPage<T>>,
  limit: number,
  enabled = true,
): SearchList<T> {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPage(pageParam, limit),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    enabled,
  });
  const pages = query.data?.pages;
  // A page can hand out one item more than asked, so neighbours may share one.
  const items = useMemo(() => {
    const seen = new Set<number>();
    return (pages ?? []).flatMap((page) =>
      page.items.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      }),
    );
  }, [pages]);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isError } = query;
  return {
    items,
    total: pages?.[0]?.total ?? null,
    pending: query.isPending,
    error: isError ? query.error : null,
    hasMore: hasNextPage && !isError,
    loadingMore: isFetchingNextPage,
    loadMore: () => {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage({ cancelRefetch: false });
    },
    retry: () => {
      if (query.data) void fetchNextPage({ cancelRefetch: false });
      else void query.refetch();
    },
  };
}

export function useTrackResults(query: string, filters: TrackFilters = {}) {
  const clean = cleanFilters(filters);
  return useSearchList(
    ["search", query, "tracks", clean],
    (offset, limit) => searchTracks(query, clean, { offset, limit }),
    TRACK_PAGE,
  );
}

export function useUserResults(query: string) {
  return useSearchList(
    ["search", query, "users"],
    (offset, limit) => searchUsers(query, { offset, limit }),
    TILE_PAGE,
  );
}

export function usePlaylistResults(query: string) {
  return useSearchList(
    ["search", query, "playlists"],
    (offset, limit) => searchPlaylists(query, { offset, limit }),
    TILE_PAGE,
  );
}

export function useAlbumResults(query: string) {
  return useSearchList(
    ["search", query, "albums"],
    (offset, limit) => searchAlbums(query, { offset, limit }),
    TILE_PAGE,
  );
}

/** The genres among the tracks found, counted with the other filters but not the genre. */
export function useGenres(query: string, filters: TrackFilters, enabled: boolean) {
  const others = cleanFilters({ ...filters, genre: null });
  return useQuery({
    queryKey: ["search", query, "genres", others],
    queryFn: () => searchTrackGenres(query, others),
    enabled,
  });
}

/** Lines to complete what is typed; the last answer stays while the next is asked. */
export function useSuggestions(text: string) {
  return useQuery({
    queryKey: ["search", "suggest", text],
    queryFn: () => searchSuggestions(text, 8),
    enabled: text.length > 0,
    placeholderData: keepPreviousData,
  });
}

/** The few best results at once, for the field's list while typing. */
export function useQuickHits(text: string) {
  return useQuery({
    queryKey: ["search", "hits", text],
    queryFn: () => searchAll(text, { limit: 8 }),
    enabled: text.length > 1,
    placeholderData: keepPreviousData,
  });
}
