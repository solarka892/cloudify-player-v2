import { useEffect, useRef } from "react";

// The light behind «Подборка»: three soft bands in the cover's colours whose
// swell follows the playing track's waveform. Drawn in a fixed 1440×440 space
// and stretched to the width; paths are rewritten in place, never re-rendered.

const WIDTH = 1440;
const HEIGHT = 440;
const STEP = 24;

const BANDS = [
  {
    gradient: "ribbon-a",
    width: 130,
    blur: "ribbon-wide",
    amp: 120,
    freq: 0.9,
    speed: 0.16,
    y: 250,
    opacity: 0.85,
  },
  {
    gradient: "ribbon-b",
    width: 70,
    blur: "ribbon-soft",
    amp: 100,
    freq: 1.25,
    speed: -0.22,
    y: 232,
    opacity: 0.95,
  },
  {
    gradient: "ribbon-a",
    width: 26,
    blur: "ribbon-soft",
    amp: 84,
    freq: 1.7,
    speed: 0.3,
    y: 268,
    opacity: 0.95,
  },
] as const;

export interface RibbonProps {
  playing: boolean;
  /** Height of the swell (moods change it). */
  energy: number;
  /** Speed of the drift (moods change it). */
  pace: number;
  /** The playing track's loudness, 0…1 across its length; `null` breathes evenly. */
  loudness: readonly number[] | null;
  className?: string;
}

function swellAt(loudness: readonly number[] | null, u: number): number {
  if (!loudness || loudness.length < 2) return 0.7 + 0.2 * Math.sin(u * Math.PI * 2);
  const f = (((u % 1) + 1) % 1) * (loudness.length - 1);
  const i = Math.floor(f);
  const t = f - i;
  const a = loudness[i] ?? 0;
  const b = loudness[Math.min(i + 1, loudness.length - 1)] ?? a;
  return 0.35 + 0.65 * (a * (1 - t) + b * t);
}

export function Ribbon({ playing, energy, pace, loudness, className = "" }: RibbonProps) {
  const svg = useRef<SVGSVGElement>(null);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const live = useRef({ playing, energy, pace, loudness });
  useEffect(() => {
    live.current = { playing, energy, pace, loudness };
  }, [playing, energy, pace, loudness]);

  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let phase = 0;
    // Mood changes ease in rather than jump.
    let shownEnergy = live.current.energy;
    let shownPace = live.current.pace;
    let last = performance.now();
    let lastDraw = 0;
    let frame = 0;
    let onScreen = true;

    const draw = () => {
      const { loudness: wave } = live.current;
      for (const [i, band] of BANDS.entries()) {
        const points: string[] = [];
        for (let x = -60; x <= WIDTH + 60; x += STEP) {
          const u = x / WIDTH;
          const wave_ = Math.sin(u * Math.PI * 2 * band.freq + phase * band.speed * 6);
          const y = band.y + wave_ * band.amp * shownEnergy * swellAt(wave, u + phase * 0.02);
          points.push(`${x},${y.toFixed(1)}`);
        }
        paths.current[i]?.setAttribute("d", `M${points.join(" L")}`);
      }
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const { playing: on, energy: e, pace: p } = live.current;
      // Slow, soft light reads smooth at low frame rates; idle costs even less.
      if (now - lastDraw < (on ? 33 : 66)) return;
      const dt = Math.min(100, now - last);
      last = now;
      lastDraw = now;
      const ease = Math.min(1, dt / 500);
      shownEnergy += (e - shownEnergy) * ease;
      shownPace += (p - shownPace) * ease;
      phase += (dt / 1000) * (on ? 1 : 0.35) * shownPace;
      draw();
    };

    const run = () => {
      if (still || frame || !onScreen || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const halt = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    draw();
    run();
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      if (onScreen) run();
      else halt();
    });
    visibility.observe(node);
    const onVisibility = () => (document.hidden ? halt() : run());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      halt();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`ribbon-fade ${className}`}
    >
      <defs>
        <linearGradient id="ribbon-a" x1="0" x2="1">
          <stop offset="0" style={{ stopColor: "var(--glow-2)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--glow-1)" }} />
          <stop offset="1" style={{ stopColor: "var(--glow-3)" }} />
        </linearGradient>
        <linearGradient id="ribbon-b" x1="0" x2="1">
          <stop offset="0" style={{ stopColor: "var(--glow-3)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--glow-2)" }} />
          <stop offset="1" style={{ stopColor: "var(--glow-1)" }} />
        </linearGradient>
        <filter
          id="ribbon-soft"
          filterUnits="userSpaceOnUse"
          x="-200"
          y="-300"
          width="1840"
          height="1040"
        >
          <feGaussianBlur stdDeviation="26" />
        </filter>
        <filter
          id="ribbon-wide"
          filterUnits="userSpaceOnUse"
          x="-200"
          y="-300"
          width="1840"
          height="1040"
        >
          <feGaussianBlur stdDeviation="48" />
        </filter>
      </defs>
      {BANDS.map((band, i) => (
        <path
          key={`${band.gradient}-${band.width}`}
          ref={(node) => {
            paths.current[i] = node;
          }}
          fill="none"
          stroke={`url(#${band.gradient})`}
          strokeWidth={band.width}
          strokeLinecap="round"
          filter={`url(#${band.blur})`}
          opacity={band.opacity}
          style={{ mixBlendMode: "screen" }}
        />
      ))}
    </svg>
  );
}
