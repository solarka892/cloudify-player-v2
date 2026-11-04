import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { DaySummary } from "@/api/types";
import { dayDate, dayNumber, daysUpTo, dayWord, isMonday, isWeekend } from "@/features/diary/days";
import { formatLength } from "@/ui/format";

/** One day's column: its width with the gap after it. */
const COLUMN = 30;
const MOST_DAYS = 31;
const FEWEST_DAYS = 7;
/** The tallest bar. */
const BAR = 30;

/**
 * The last weeks as a strip, one bar per day by how much was heard, as many
 * days as fit. The day on screen is lit; pressing a day goes to it.
 */
export function DayStrip({
  days,
  today,
  current,
  onPick,
}: {
  days: readonly DaySummary[];
  today: string;
  /** The day at the top of the screen. */
  current: string | null;
  onPick: (day: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(22);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => {
      // A week's divider takes a little room too.
      const room = node.clientWidth - 12;
      setCount(Math.max(FEWEST_DAYS, Math.min(MOST_DAYS, Math.floor(room / COLUMN))));
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    return () => resize.disconnect();
  }, []);

  const heard = useMemo(() => new Map(days.map((day) => [day.day, day])), [days]);
  const keys = daysUpTo(today, count);
  const most = Math.max(1, ...keys.map((key) => heard.get(key)?.heardMs ?? 0));

  return (
    <nav
      ref={box}
      aria-label="Дни"
      className="flex h-[52px] min-w-0 flex-1 items-end justify-end gap-1"
    >
      {keys.map((key, i) => {
        const day = heard.get(key);
        const ms = day?.heardMs ?? 0;
        const lit = key === current;
        const name = `${dayWord(key, today)}, ${dayDate(key, today)}`;
        const said = day ? `${name}: ${formatLength(ms)}` : `${name}: ничего не играло`;
        return (
          <Fragment key={key}>
            {i > 0 && isMonday(key) && (
              <span
                aria-hidden="true"
                className="mx-1 mb-4 h-[30px] w-px shrink-0 bg-white/[0.12]"
              />
            )}
            <button
              type="button"
              disabled={!day}
              onClick={() => onPick(key)}
              aria-label={said}
              aria-current={lit ? "date" : undefined}
              title={said}
              className={`group/day grid h-[52px] w-[26px] shrink-0 grid-rows-[1fr_auto] justify-items-center gap-1 rounded-lg pt-0.5 font-bold text-[10.5px] tabular-nums leading-none transition-colors disabled:cursor-default ${lit ? "text-fg" : isWeekend(key) ? "text-fg-muted" : "text-fg-faint"} enabled:hover:text-fg`}
            >
              <i
                aria-hidden="true"
                style={{ height: `${Math.max(3, Math.round((ms / most) * BAR))}px` }}
                className={`w-2.5 self-end rounded-t-[3px] rounded-b-[1px] transition-colors ${
                  lit
                    ? "bg-linear-to-b from-glow-1 to-glow-2"
                    : day
                      ? "bg-white/[0.26] group-hover/day:bg-white/50"
                      : "bg-white/[0.08]"
                }`}
              />
              <span>{dayNumber(key)}</span>
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
