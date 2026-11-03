import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { formatSeconds } from "@/ui/format";

interface WaveformSeekProps {
  /** 0…1 loudness across the track; `null` draws a quiet even line. */
  loudness: readonly number[] | null;
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
  disabled?: boolean;
}

const BAR = 4;
const GAP = 2;

/** The real waveform of the playing track, which is also where you seek. */
export function WaveformSeek({
  loudness,
  position,
  duration,
  onSeek,
  disabled = false,
}: WaveformSeekProps) {
  const box = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(90);
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      setCount(Math.max(16, Math.floor((width + GAP) / (BAR + GAP))));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const played = dragging ?? (duration > 0 ? position / duration : 0);
  const bars = Array.from({ length: count }, (_, id) => {
    let level = 0.3;
    if (loudness && loudness.length > 0) {
      const from = Math.floor((id / count) * loudness.length);
      const to = Math.max(from + 1, Math.floor(((id + 1) / count) * loudness.length));
      level = 0;
      for (let j = from; j < to; j++) level = Math.max(level, loudness[j] ?? 0);
    }
    return { id, height: 8 + Math.max(0.12, level) * 26, done: id / count < played };
  });

  const fractionAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(fractionAt(event));
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging !== null) setDragging(fractionAt(event));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging === null) return;
    onSeek(fractionAt(event) * duration);
    setDragging(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    const steps: Record<string, number> = {
      ArrowLeft: position - 5,
      ArrowRight: position + 5,
      PageDown: position - 30,
      PageUp: position + 30,
      Home: 0,
      End: duration - 1,
    };
    const target = steps[event.key];
    if (target === undefined) return;
    event.preventDefault();
    onSeek(Math.max(0, Math.min(duration, target)));
  };

  return (
    <div
      ref={box}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Перемотка"
      aria-disabled={disabled}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(played * duration)}
      aria-valuetext={`${formatSeconds(played * duration)} из ${formatSeconds(duration)}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDragging(null)}
      onKeyDown={onKeyDown}
      className="flex h-[34px] touch-none items-center gap-0.5 rounded-sm aria-disabled:cursor-default"
    >
      {bars.map((bar) => (
        <i
          key={bar.id}
          className={`flex-1 rounded-[2px] ${bar.done ? "bg-linear-to-b from-glow-1 to-glow-2" : "bg-white/[0.18]"}`}
          style={{ height: `${Math.round(bar.height)}px` }}
        />
      ))}
    </div>
  );
}
