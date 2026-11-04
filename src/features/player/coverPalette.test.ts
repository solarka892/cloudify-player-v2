import { describe, expect, it } from "vitest";
import {
  awayFromYellow,
  hslCss,
  paletteFromPixels,
  rgbToHsl,
  shiftHue,
} from "@/features/player/coverPalette";

function image(...colours: [number, number, number, number][]): number[] {
  // [r, g, b, howMany]
  return colours.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [r, g, b, 255]).flat());
}

describe("cover palette", () => {
  it("reads hues the usual way", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual([0, 1, 0.5]);
    expect(rgbToHsl(0, 0, 255)[0]).toBe(240);
    expect(rgbToHsl(128, 128, 128)[1]).toBe(0);
  });

  it("puts the cover's main colour first and lifts it to glow", () => {
    const [first, second] = paletteFromPixels(
      image([230, 40, 30, 300], [120, 60, 200, 120], [250, 250, 250, 500]),
    );
    expect(first[0]).toBeLessThan(30);
    expect(second[0]).toBeGreaterThan(240);
    expect(first[2]).toBeGreaterThanOrEqual(0.52);
    expect(first[2]).toBeLessThanOrEqual(0.66);
  });

  it("ignores grey and fills in a colourless cover", () => {
    const palette = paletteFromPixels(image([20, 20, 20, 400], [240, 240, 240, 400]));
    expect(palette).toHaveLength(3);
    expect(new Set(palette.map(([h]) => Math.round(h))).size).toBe(3);
  });

  it("completes a single-hue cover with its neighbours", () => {
    const [main, two, three] = paletteFromPixels(image([30, 90, 230, 500]));
    expect(Math.round(two[0])).toBe(Math.round((main[0] + 50) % 360));
    expect(Math.round(three[0])).toBe(Math.round((main[0] + 100) % 360));
  });

  it("keeps a mood's turn off yellow", () => {
    expect(awayFromYellow([50, 0.9, 0.6])[0]).toBe(38);
    expect(awayFromYellow([62, 0.9, 0.6])[0]).toBe(74);
    expect(awayFromYellow([20, 0.9, 0.6])[0]).toBe(20);
    expect(awayFromYellow([200, 0.9, 0.6])[0]).toBe(200);
  });

  it("shifts and prints", () => {
    expect(shiftHue([350, 1, 0.5], 20)[0]).toBe(10);
    expect(shiftHue([10, 1, 0.5], -25)[0]).toBe(345);
    expect(hslCss([12.4, 0.856, 0.6])).toBe("hsl(12 86% 60%)");
  });
});
