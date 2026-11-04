interface SectionHeaderProps {
  id: string;
  title: string;
  /** Quiet numbers after the title: «1 312». */
  count?: string | null;
  onAll?: () => void;
}

export function SectionHeader({ id, title, count, onAll }: SectionHeaderProps) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 id={id} className="font-bold font-display text-[19px] leading-none tracking-[-0.02em]">
        {title}
      </h2>
      {count && (
        <span className="font-bold text-[14px] text-fg-faint tabular-nums leading-none">
          {count}
        </span>
      )}
      {onAll && (
        <button
          type="button"
          onClick={onAll}
          className="ml-auto rounded-md font-bold text-[13.5px] text-fg-muted leading-none transition-colors hover:text-fg"
        >
          Все
        </button>
      )}
    </div>
  );
}

/** A section that could not load: why, and «Ещё раз» only when asking again can help. */
export function SectionProblem({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="mt-[18px] rounded-[18px] bg-panel p-4 text-[13.5px] text-fg-muted">
      <p>{text}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 h-8 rounded-full bg-white/10 px-3.5 font-bold text-fg transition-colors hover:bg-white/15"
        >
          Ещё раз
        </button>
      )}
    </div>
  );
}
