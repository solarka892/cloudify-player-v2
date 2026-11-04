import { Shuffle } from "lucide-react";
import type { Me } from "@/api/types";
import { Chips } from "@/features/library/Chips";
import { shuffleLikes } from "@/features/library/play";
import { useAllLikes } from "@/features/library/queries";
import { FilterField, primaryButton, StageActions } from "@/features/library/Stage";
import { formatCount } from "@/ui/format";

/**
 * What every section starts with: the white «Перемешать» pill and the filter,
 * sticking under the top bar, then the section chips.
 */
export function SectionTop({
  me,
  shuffle,
  query,
  onQuery,
  placeholder,
  found,
}: {
  me: Me;
  /** The pill: its words, and what it shuffles. */
  shuffle: { label: string; run: () => void; disabled: boolean };
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  found: string | null;
}) {
  return (
    <>
      <StageActions>
        <button
          type="button"
          disabled={shuffle.disabled}
          onClick={shuffle.run}
          className={primaryButton}
        >
          <Shuffle className="size-5" aria-hidden="true" />
          {shuffle.label}
        </button>
        <FilterField value={query} onChange={onQuery} placeholder={placeholder} found={found} />
      </StageActions>
      <Chips me={me} />
    </>
  );
}

/** The library's own big button: every like, really all of them, in a fresh order. */
export function useShuffleAllLikes(me: Me) {
  const likes = useAllLikes();
  const tracks = likes.items.map((like) => like.track);
  const count = likes.complete ? tracks.length : me.user.likesCount;
  return {
    label: count ? `Перемешать все ${formatCount(count)}` : "Перемешать все",
    run: () => shuffleLikes(tracks, "", likes.complete),
    disabled: tracks.length === 0,
  };
}

/** A section's heading inside the page: «Лайки 1 574». */
export function SectionTitle({
  id,
  title,
  count,
}: {
  id: string;
  title: string;
  count?: string | null;
}) {
  return (
    <div className="mb-[18px] flex items-baseline gap-2.5">
      <h2 id={id} className="font-bold font-display text-[19px] leading-none tracking-[-0.02em]">
        {title}
      </h2>
      {count && (
        <span className="font-bold text-[14px] text-fg-faint tabular-nums leading-none">
          {count}
        </span>
      )}
    </div>
  );
}
