import { type RefObject, useDeferredValue, useMemo, useState } from "react";
import { useScrollRoot } from "@/app/scrollRoot";
import { makeFilter, queryWords } from "@/features/library/filter";

/** The top bar and the stuck actions row (what covers the top of the page), plus a breath. */
const COVERED = 68 + 78 + 8;

/**
 * A stage's filter over `items`. Typing keeps up even over thousands of rows
 * (the list follows a moment later), and a page scrolled deep into the list
 * comes back to where the results start. `text` should be a stable function.
 */
export function useListFilter<T>(
  items: readonly T[],
  text: (item: T) => string,
  listStart: RefObject<HTMLElement | null>,
) {
  const scroller = useScrollRoot();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const filter = useMemo(() => makeFilter(items, text), [items, text]);
  const shown = useMemo(() => filter(deferred), [filter, deferred]);

  const onQuery = (value: string) => {
    setQuery(value);
    const node = listStart.current;
    if (!node || !scroller) return;
    const top =
      node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    if (scroller.scrollTop > top - COVERED) scroller.scrollTo({ top: top - COVERED });
  };

  return { query, onQuery, shown, filtering: queryWords(deferred).length > 0 };
}
