// The light on screen takes its colours from the cover of what is playing:
// the three strongest hues of the artwork, lifted so they glow on a dark ground.

export type Hsl = readonly [hue: number, saturation: number, lightness: number];

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

/**
 * The three most present hues among `rgba` pixels (4 bytes each). Grey, near-black
 * and near-white pixels count for little, so a cover's colour wins over its
 * background. A cover with fewer than three hues is completed with neighbours
 * of its main one; a colourless cover gets a warm default.
 */
export function paletteFromPixels(rgba: ArrayLike<number>): [Hsl, Hsl, Hsl] {
  const bins = Array.from({ length: 12 }, () => ({ weight: 0, h: 0, s: 0, l: 0 }));
  for (let i = 0; i + 2 < rgba.length; i += 4) {
    const [h, s, l] = rgbToHsl(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0);
    const weight = s * (1 - Math.abs(l - 0.5) * 1.6);
    if (weight <= 0.05) continue;
    const bin = bins[Math.floor(h / 30) % 12];
    if (!bin) continue;
    bin.weight += weight;
    bin.h += h * weight;
    bin.s += s * weight;
    bin.l += l * weight;
  }
  const picks: Hsl[] = bins
    .filter((bin) => bin.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((bin) => [
      bin.h / bin.weight,
      Math.min(1, bin.s / bin.weight + 0.25),
      Math.min(0.66, Math.max(0.52, bin.l / bin.weight + 0.08)),
    ]);
  while (picks.length < 3) {
    const main = picks[0];
    picks.push(
      main ? [(main[0] + 50 * picks.length) % 360, 0.85, 0.6] : [20 + 130 * picks.length, 0.9, 0.6],
    );
  }
  return [picks[0], picks[1], picks[2]] as [Hsl, Hsl, Hsl];
}

export function shiftHue([h, s, l]: Hsl, degrees: number): Hsl {
  return [(((h + degrees) % 360) + 360) % 360, s, l];
}

/** Yellow, roughly: a mood's turn must not land here; a cover's own yellow is the music's. */
const YELLOW = [44, 68] as const;

/** Moves a hue that a mood turned onto yellow to the nearer of orange or lime. */
export function awayFromYellow([h, s, l]: Hsl): Hsl {
  const [from, to] = YELLOW;
  if (h <= from || h >= to) return [h, s, l];
  return [h - from < to - h ? from - 6 : to + 6, s, l];
}

export function hslCss([h, s, l]: Hsl): string {
  return `hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`;
}
