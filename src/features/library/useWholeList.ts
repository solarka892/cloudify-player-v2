import { type QueryKey, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { Page, PageRequest } from "@/api/types";

/** A whole cursor-paged list as it arrives: what is here so far, and whether that is all. */
export interface WholeList<T> {
  items: T[];
  /** Every page is in (or as many as the list is allowed). */
  complete: boolean;
  /** Nothing is in yet. */
  pending: boolean;
  error: unknown;
  retry: () => void;
}

interface Options {
  enabled?: boolean;
  /** Stop after this many pages of 200 (play history can be endless). */
  maxPages?: number;
}

/**
 * Pages through a SoundCloud list to its end, one page after another, as soon
 * as it is used. The library filters and shuffles the whole list, never only
 * the part that happens to be loaded. `pick` should be a stable function.
 */
export function useWholeList<P, T>(
  key: QueryKey,
  fetchPage: (page: PageRequest) => Promise<Page<P>>,
  pick: (item: P) => T,
  { enabled = true, maxPages = Number.POSITIVE_INFINITY }: Options = {},
): WholeList<T> {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPage(pageParam ? { cursor: pageParam } : { limit: 200 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last, pages) => (pages.length < maxPages ? last.next : null),
    enabled,
  });
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;

  useEffect(() => {
    // Several screens may watch one list; only one of them asks for the next page.
    if (hasNextPage && !isFetchingNextPage && !isError)
      void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const pages = query.data?.pages;
  const items = useMemo(() => pages?.flatMap((page) => page.items.map(pick)) ?? [], [pages, pick]);

  return {
    items,
    complete: query.isSuccess && !hasNextPage,
    pending: query.isPending,
    error: query.isError ? query.error : null,
    retry: () => {
      if (query.data) void fetchNextPage({ cancelRefetch: false });
      else void query.refetch();
    },
  };
}
