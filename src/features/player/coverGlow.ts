import { useEffect, useState } from "react";
import {
  awayFromYellow,
  type Hsl,
  hslCss,
  paletteFromPixels,
  shiftHue,
} from "@/features/player/coverPalette";
import { artworkUrl } from "@/ui/artworkUrl";

const palettes = new Map<string, Promise<[Hsl, Hsl, Hsl]>>();

/** Reads a cover's palette once; SoundCloud's image CDN allows it (`access-control-allow-origin: *`). */
function paletteOf(url: string): Promise<[Hsl, Hsl, Hsl]> {
  let palette = palettes.get(url);
  if (!palette) {
    palette = (async () => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = artworkUrl(url, 100);
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 40;
      canvas.height = 40;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no 2d canvas");
      ctx.drawImage(img, 0, 0, 40, 40);
      return paletteFromPixels(ctx.getImageData(0, 0, 40, 40).data);
    })();
    palette.catch(() => palettes.delete(url));
    palettes.set(url, palette);
  }
  return palette;
}

/**
 * The three glow colours of one cover as CSS, for a light of its own (the
 * library's stage); `null` without a cover or until it has been read.
 */
export function useCoverColours(artwork: string | null): readonly [string, string, string] | null {
  const [colours, setColours] = useState<readonly [string, string, string] | null>(null);
  useEffect(() => {
    if (!artwork) return;
    let current = true;
    paletteOf(artwork).then(
      ([a, b, c]) => {
        if (current) setColours([hslCss(a), hslCss(b), hslCss(c)]);
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [artwork]);
  // From one cover to the next the old colours stay until the new ones are read,
  // so the light fades straight across instead of detouring through the default.
  return artwork ? colours : null;
}

/**
 * Paints the app's three glow colours from `artwork`, turned by `hueShift`
 * degrees (moods move the light). The colours cross-fade on their own (CSS
 * `@property` transitions); a cover that cannot be read keeps the old ones.
 */
export function useCoverGlow(artwork: string | null, hueShift: number) {
  useEffect(() => {
    if (!artwork) return;
    let current = true;
    paletteOf(artwork).then(
      (palette) => {
        if (!current) return;
        const root = document.documentElement.style;
        for (const [i, colour] of palette.entries()) {
          const turned = shiftHue(colour, hueShift);
          root.setProperty(`--glow-${i + 1}`, hslCss(hueShift ? awayFromYellow(turned) : turned));
        }
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [artwork, hueShift]);
}
