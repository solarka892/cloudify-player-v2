import { ArrowDown, ArrowUp, ChevronLeft, Search, X } from "lucide-react";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { isRetryable } from "@/api/invoke";
import { useScrollRoot } from "@/app/scrollRoot";
import { describeError } from "@/ui/errors";
import { formatCount } from "@/ui/format";

// The library's parts that every section shares: the opened name on the
// light, a row of actions that sticks under the top bar, the filter, and the
// plain-words notes for empty and failed states.

/** How wide `text` runs on one line in the title's face, at 100 px. */
function measureTitle(text: string): number {
  const probe = document.createElement("span");
  probe.textContent = text;
  probe.style.cssText =
    'position:absolute;visibility:hidden;white-space:nowrap;font:800 100px "Unbounded Variable",ui-sans-serif,system-ui,sans-serif;letter-spacing:-0.055em';
  document.body.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

/**
 * The opened name, as big as its column allows: on one line up to 112 px
 * while that stays bold enough to read as a place, otherwise balanced over
 * two lines, or three for a very long name. Measured, because «ШЩЖ» and
 * «ill» differ fourfold in width and a playlist can be called anything.
 */
function FitTitle({ title }: { title: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [fit, setFit] = useState({ size: 80, lines: 2 });

  useLayoutEffect(() => {
    const column = heading.current?.parentElement;
    if (!column) return;
    const measure = () => {
      const room = column.clientWidth;
      const at100 = measureTitle(title);
      if (!room || !at100) return;
      const oneLine = (100 * room) / at100;
      const next =
        oneLine >= 64
          ? { size: Math.min(112, oneLine), lines: 1 }
          : (200 * room * 0.88) / at100 >= 44
            ? { size: Math.min(84, (200 * room * 0.88) / at100), lines: 2 }
            : { size: Math.max(34, Math.min(60, (300 * room * 0.82) / at100)), lines: 3 };
      setFit((old) =>
        old.lines === next.lines && Math.abs(old.size - next.size) < 0.5 ? old : next,
      );
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(column);
    // The face may still be loading on the very first open.
    void document.fonts.ready.then(measure);
    return () => resize.disconnect();
  }, [title]);

  return (
    <h1
      ref={heading}
      style={{ fontSize: `${fit.size}px`, WebkitLineClamp: fit.lines }}
      className={`font-display font-extrabold leading-[0.92] tracking-[-0.055em] [overflow-wrap:anywhere] [text-shadow:0_10px_50px_rgb(0_0_0/0.35)] ${fit.lines === 1 ? "whitespace-nowrap" : "line-clamp-2 text-balance"}`}
    >
      {title}
    </h1>
  );
}

export function StageHeader({
  title,
  lead,
  aside,
  back,
}: {
  title: string;
  /** One line under the name: what it is and how much of it there is. */
  lead: ReactNode;
  /** The opened thing's cover or face, on wide stages. */
  aside?: ReactNode;
  back?: { label: string; onClick: () => void };
}) {
  return (
    <header className="flex items-end gap-10 pt-[clamp(88px,13vh,112px)] pb-6">
      <div className="min-w-0 flex-1">
        {back && (
          <button
            type="button"
            onClick={back.onClick}
            className="-ml-1.5 mb-3 flex h-8 items-center gap-1 rounded-full pr-3 pl-1.5 font-bold text-[14px] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="size-[18px]" aria-hidden="true" />
            {back.label}
          </button>
        )}
        <FitTitle title={title} />
        <p className="mt-[18px] max-w-[60ch] text-[17px] text-white/80 leading-[1.45] [text-shadow:0_2px_16px_rgb(0_0_0/0.4)]">
          {lead}
        </p>
      </div>
      {aside && <div className="hidden shrink-0 @3xl:block">{aside}</div>}
    </header>
  );
}

/**
 * The stage's actions. Once the header scrolls away the row stays under the
 * top bar, grown the same frosted backing, so play, shuffle and the filter are
 * never more than a glance away in a list of thousands.
 */
export function StageActions({ children }: { children: ReactNode }) {
  const scroller = useScrollRoot();
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !scroller) return;
    // Stuck means the line just above the row has gone up under the top bar
    // (not merely out of sight below, before the page has scrolled at all).
    const watch = new IntersectionObserver(
      ([entry]) =>
        setStuck(entry?.rootBounds ? entry.boundingClientRect.top < entry.rootBounds.top : false),
      { root: scroller, rootMargin: "-68px 0px 0px 0px" },
    );
    watch.observe(node);
    return () => watch.disconnect();
  }, [scroller]);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <div
        className={`sticky top-[68px] z-20 -mx-14 mb-3 flex items-center gap-3 px-14 py-3 transition-[background-color,backdrop-filter] duration-200 ${stuck ? "bg-ground/80 backdrop-blur-xl" : ""}`}
      >
        {children}
        <JumpButton />
      </div>
    </>
  );
}

/**
 * A long list's shortcut, beside the filter: to the oldest like and back.
 * There only on pages several screens long, pointing the way that is further.
 */
function JumpButton() {
  const scroller = useScrollRoot();
  const [way, setWay] = useState<"down" | "up" | null>(null);

  useEffect(() => {
    if (!scroller) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = scroller;
      if (scrollHeight < clientHeight * 4) setWay(null);
      else setWay(scrollTop > (scrollHeight - clientHeight) / 2 ? "up" : "down");
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    for (const child of scroller.children) resize.observe(child);
    return () => {
      scroller.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, [scroller]);

  if (!way) return null;
  const label = way === "up" ? "В начало списка" : "В конец списка";
  const Arrow = way === "up" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() =>
        scroller?.scrollTo({ top: way === "up" ? 0 : scroller.scrollHeight, behavior: "instant" })
      }
      className="ml-auto grid size-10 shrink-0 place-content-center rounded-full bg-[rgb(10_10_12/0.62)] text-white/80 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] transition-colors duration-150 hover:bg-[rgb(40_40_46/0.72)] hover:text-white"
    >
      <Arrow className="size-[18px]" aria-hidden="true" />
    </button>
  );
}

/** The opened thing's face beside its name, the size of the home hero's cover. */
export const asideCover =
  "w-[clamp(180px,20cqi,240px)] rounded-[26px] shadow-[0_30px_60px_-24px_rgb(0_0_0/0.8)]";

/** «120 из 1 312» for the filter field, or nothing while it is empty. */
export function foundLine(filtering: boolean, shown: number, total: number): string | null {
  return filtering ? `${formatCount(shown)} из ${formatCount(total)}` : null;
}

export const primaryButton =
  "flex h-[54px] shrink-0 items-center gap-2.5 rounded-full bg-white pr-[26px] pl-5 font-extrabold text-[16px] text-ink transition-transform duration-150 ease-out hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

export const roundButton =
  "grid size-[54px] shrink-0 place-content-center rounded-full bg-[rgb(10_10_12/0.62)] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] transition-colors duration-150 hover:bg-[rgb(40_40_46/0.72)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[rgb(10_10_12/0.62)]";

/** The stage's filter. ⌘F / Ctrl+F jumps here; Escape empties it. */
export function FilterField({
  value,
  onChange,
  placeholder,
  found = null,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** How much matched, said inside the field: «120 из 1 312». */
  found?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <label
      // Smoke, not the top bar's veil: the field sits on the light, and a white
      // wash vanishes into its brightest band.
      className={`flex h-10 min-w-[150px] shrink items-center gap-2.5 rounded-[20px] bg-[rgb(10_10_12/0.62)] pr-1.5 pl-4 text-white/70 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] transition-colors focus-within:bg-[rgb(40_40_46/0.72)] w-[340px]`}
    >
      <Search className="size-[18px] shrink-0" aria-hidden="true" />
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.stopPropagation();
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent font-semibold text-fg outline-none placeholder:text-white/70 [&::-webkit-search-cancel-button]:hidden"
      />
      {found && (
        <span className="shrink-0 whitespace-nowrap font-bold text-[12.5px] text-white/65 tabular-nums">
          {found}
        </span>
      )}
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          aria-label="Очистить"
          className="grid size-7 shrink-0 place-content-center rounded-full text-fg-muted transition-colors hover:bg-white/10 hover:text-fg"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </label>
  );
}

/**
 * Why the stage is empty or could not load, in plain words; «Ещё раз» only
 * when it can help. With both, `text` says what happened and the error why.
 */
export function StageNote({
  text,
  error,
  onRetry,
}: {
  text?: string;
  error?: unknown;
  onRetry?: () => void;
}) {
  const failed = error !== undefined && error !== null;
  const retry = failed && onRetry && isRetryable(error) ? onRetry : null;
  return (
    <div className="mt-2 max-w-[560px] rounded-[18px] bg-panel p-4 text-[13.5px] text-fg-muted">
      <p>{[text, failed ? describeError(error) : null].filter(Boolean).join(" ")}</p>
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="mt-3 h-8 rounded-full bg-white/10 px-3.5 font-bold text-fg transition-colors hover:bg-white/15"
        >
          Ещё раз
        </button>
      )}
    </div>
  );
}

/** Nothing matched the filter. */
export function NoMatch({ query }: { query: string }) {
  return <StageNote text={`Ничего не нашлось по «${query.trim()}». Попробуй часть слова.`} />;
}
