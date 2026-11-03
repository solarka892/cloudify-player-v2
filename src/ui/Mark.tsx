/** Cloudify's mark: one swell of a sound wave, drawn in the playing cover's colour. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path
        d="M5 27c4.5 0 4.5-9 9-9s4.5 15 9 15 4.5-21 9-21 4.5 15 9 15"
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <div data-tauri-drag-region className="flex items-center gap-2.5">
      <Mark className="pointer-events-none size-[30px] text-glow-1" />
      <span className="pointer-events-none font-bold font-display text-[19px] leading-none tracking-[-0.02em]">
        Cloudify
      </span>
    </div>
  );
}
