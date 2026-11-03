import { type RefObject, useEffect, useRef } from "react";
import { useScrollRoot } from "@/app/scrollRoot";

/**
 * Pages the next part of a list in while `end` (a mark after its last row) is
 * still a couple of screens away, so scrolling never runs into the bottom.
 */
export function useLoadMore(
  end: RefObject<HTMLElement | null>,
  list: { hasMore: boolean; loadingMore: boolean; loadMore: () => void },
) {
  const scroller = useScrollRoot();
  const load = useRef(list.loadMore);
  load.current = list.loadMore;
  const { hasMore, loadingMore } = list;

  useEffect(() => {
    const node = end.current;
    if (!node || !scroller || !hasMore || loadingMore) return;
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) load.current();
      },
      { root: scroller, rootMargin: "0px 0px 1200px 0px" },
    );
    watch.observe(node);
    return () => watch.disconnect();
  }, [end, scroller, hasMore, loadingMore]);
}
