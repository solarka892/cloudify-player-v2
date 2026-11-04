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

/** A section with nothing in it yet, and why. (One that could not load keeps its shape: `Held`.) */
export function SectionProblem({ text }: { text: string }) {
  return (
    <div className="mt-[18px] rounded-[18px] bg-panel p-4 text-[13.5px] text-fg-muted">
      <p>{text}</p>
    </div>
  );
}
