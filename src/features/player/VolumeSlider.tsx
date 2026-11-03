import { type KeyboardEvent, type PointerEvent, useState } from "react";

interface VolumeSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function VolumeSlider({ value, onChange }: VolumeSliderProps) {
  const [dragging, setDragging] = useState(false);

  const valueAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowLeft: value - 0.05,
      ArrowDown: value - 0.05,
      ArrowRight: value + 0.05,
      ArrowUp: value + 0.05,
      Home: 0,
      End: 1,
    };
    const target = steps[event.key];
    if (target === undefined) return;
    event.preventDefault();
    onChange(Math.min(1, Math.max(0, target)));
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Громкость"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        onChange(valueAt(event));
      }}
      onPointerMove={(event) => dragging && onChange(valueAt(event))}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={onKeyDown}
      className="group flex h-5 w-[72px] touch-none items-center rounded-sm min-[1101px]:w-[92px]"
    >
      <span className="relative h-1 w-full rounded-sm bg-white/[0.14]">
        <span
          className="absolute inset-y-0 left-0 rounded-sm bg-fg-muted transition-colors group-hover:bg-fg"
          style={{ width: `${value * 100}%` }}
        />
      </span>
    </div>
  );
}
