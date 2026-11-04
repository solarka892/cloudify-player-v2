// The library's filter: type a few letters of a title or an artist and only
// what matches stays. Case, «ё», accents and punctuation never get in the way.
// (Transliteration — `vyazki` finding «Вязки» — comes with the offline search.)

/**
 * Text as the filter compares it: lower case, accents and «ё»/«й» marks
 * dropped (query and titles alike, so both sides agree), anything that is not
 * a letter or a digit read as a space.
 */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The query's words; an empty list keeps everything. */
export function queryWords(query: string): string[] {
  const folded = fold(query);
  return folded ? folded.split(" ") : [];
}

/** Every word must appear somewhere in the folded text, in any order. */
export function matches(folded: string, words: readonly string[]): boolean {
  return words.every((word) => folded.includes(word));
}

/**
 * Keeps the items whose text matches every word of the query. `text` is
 * folded once per item and list, not once per keystroke.
 */
export function makeFilter<T>(items: readonly T[], text: (item: T) => string) {
  const folded = items.map((item) => fold(text(item)));
  return (query: string): T[] => {
    const words = queryWords(query);
    if (words.length === 0) return [...items];
    return items.filter((_, i) => matches(folded[i] ?? "", words));
  };
}
