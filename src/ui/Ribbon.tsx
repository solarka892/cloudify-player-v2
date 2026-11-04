import { useEffect, useRef } from "react";

// The light behind a screen's big word («Подборка», what the library has open,
// sign-in): three soft bands in the cover's colours whose swell follows the
// playing track's waveform.
//
// Drawn small and shown big: the bands are painted, already blurred, into a
// canvas a quarter of the size of their 1440×440 drawing space, and the browser
// stretches that picture to the window. The light is nothing but soft edges, so
// it looks the same — and each frame costs a few thousand pixels instead of the
// millions an SVG blur over the whole hero re-renders (which made the window lag).

const WIDTH = 1440;
const HEIGHT = 440;
const STEP = 24;
/** Canvas pixels per drawing unit. */
const SCALE = 0.25;

/** Gradient stops: [offset, which glow colour]. */
const GRADIENTS = {
  a: [
    [0, 2],
    [0.5, 1],
    [1, 3],
  ],
  b: [
    [0, 3],
    [0.55, 2],
    [1, 1],
  ],
} as const;

const BANDS = [
  { gradient: "a", width: 130, blur: 48, amp: 120, freq: 0.9, speed: 0.16, y: 250, opacity: 0.85 },
  { gradient: "b", width: 70, blur: 26, amp: 100, freq: 1.25, speed: -0.22, y: 232, opacity: 0.95 },
  { gradient: "a", width: 26, blur: 26, amp: 84, freq: 1.7, speed: 0.3, y: 268, opacity: 0.95 },
] as const;

/** WebKit before Safari 18 has no canvas filters; there one CSS blur softens the whole light. */
const canvasCanBlur =
  typeof CanvasRenderingContext2D !== "undefined" && "filter" in CanvasRenderingContext2D.prototype;

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
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ playing, energy, pace, loudness });
  useEffect(() => {
    live.current = { playing, energy, pace, loudness };
  }, [playing, energy, pace, loudness]);

  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) return;
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
      // The glow colours cross-fade in CSS; reading them here follows the fade.
      // They are read where the light sits, so a wrapper can relight it locally.
      const style = getComputedStyle(node);
      const glow = [1, 2, 3].map((n) => style.getPropertyValue(`--glow-${n}`).trim() || "#ff9d6b");
      const { loudness: wave } = live.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, node.width, node.height);
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const band of BANDS) {
        const gradient = ctx.createLinearGradient(0, 0, WIDTH, 0);
        for (const [offset, colour] of GRADIENTS[band.gradient]) {
          gradient.addColorStop(offset, glow[colour - 1] ?? "#ff9d6b");
        }
        ctx.strokeStyle = gradient;
        ctx.lineWidth = band.width;
        ctx.globalAlpha = band.opacity;
        if (canvasCanBlur) ctx.filter = `blur(${band.blur * SCALE}px)`;
        ctx.beginPath();
        for (let x = -60; x <= WIDTH + 60; x += STEP) {
          const u = x / WIDTH;
          const sway = Math.sin(u * Math.PI * 2 * band.freq + phase * band.speed * 6);
          const y = band.y + sway * band.amp * shownEnergy * swellAt(wave, u + phase * 0.02);
          if (x === -60) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
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
    // Without motion the light still follows the cover's colours, at a walk.
    const repaint = still ? setInterval(draw, 2000) : 0;
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
      clearInterval(repaint);
      visibility.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div aria-hidden="true" className={`ribbon-fade ${className}`}>
      <canvas
        ref={canvas}
        width={WIDTH * SCALE}
        height={HEIGHT * SCALE}
        className="block size-full"
        style={canvasCanBlur ? undefined : { filter: "blur(10px)" }}
      />
    </div>
  );
}
