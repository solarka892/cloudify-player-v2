import { type KeyboardEvent, type PointerEvent, useRef } from "react";
import { NOVELTY_STEPS } from "@/features/selection/engine";

// «Знакомое ↔ новое»: thirteen stops, from only what you know to only what is
// new. A real slider: drag it, click a place, or use the arrows, Home and End.

const STOPS = Array.from({ length: NOVELTY_STEPS + 1 }, (_, i) => i);

export function MixSlider({
  value,
  label,
  onChange,
}: {
  /** 0 … 12. */
  value: number;
  /** What the position means, read out with it. */
  label: string;
  onChange: (value: number) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const share = value / NOVELTY_STEPS;

  const valueAt = (x: number) => {
    const box = rail.current?.getBoundingClientRect();
    if (!box || box.width === 0) return value;
    const at = Math.round(((x - box.left) / box.width) * NOVELTY_STEPS);
    return Math.max(0, Math.min(NOVELTY_STEPS, at));
  };
  const set = (next: number) => {
    const clamped = Math.max(0, Math.min(NOVELTY_STEPS, next));
    if (clamped !== value) onChange(clamped);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    set(valueAt(event.clientX));
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) set(valueAt(event.clientX));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: 3,
      PageDown: -3,
    };
    if (event.key === "Home") set(0);
    else if (event.key === "End") set(NOVELTY_STEPS);
    else if (event.key in step) set(value + (step[event.key] ?? 0));
    else return;
    // The window's own arrows (seek, volume) stay out of it while the slider has the focus.
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5">
      <span
        className={`font-bold text-[13.5px] ${value * 3 <= NOVELTY_STEPS ? "text-fg" : "text-fg-muted"}`}
      >
        Знакомое
      </span>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Знакомое или новое"
        aria-valuemin={0}
        aria-valuemax={NOVELTY_STEPS}
        aria-valuenow={value}
        aria-valuetext={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        className="group relative h-10 cursor-pointer touch-none rounded-full outline-offset-2"
      >
        <div
          ref={rail}
          className="absolute inset-x-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/[0.16]"
        >
          {STOPS.map((stop) => (
            <i
              key={stop}
              className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30"
              style={{ left: `${(stop / NOVELTY_STEPS) * 100}%` }}
            />
          ))}
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-glow-1 to-glow-2"
            style={{ width: `${share * 100}%` }}
          />
          <span
            className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_4px_14px_-4px_rgb(0_0_0/0.7)] transition-transform duration-100 group-active:scale-110"
            style={{ left: `${share * 100}%` }}
          />
        </div>
      </div>
      <span
        className={`font-bold text-[13.5px] ${value * 3 >= NOVELTY_STEPS * 2 ? "text-fg" : "text-fg-muted"}`}
      >
        Новое
      </span>
    </div>
  );
}
