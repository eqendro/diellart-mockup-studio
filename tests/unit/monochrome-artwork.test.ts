import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  createMonochromePixels,
  detectDominantBrandColour,
  hexToRgb,
  type RasterPixels,
} from "../../src/features/logo-engine/monochrome/pixels";
import { PRINT_COLOURS } from "../../src/features/logo-engine/monochrome/config";
import {
  prepareArtworkPixels,
  type PixelImage,
} from "../../src/features/logo-engine/preparation/process-pixels";

const fixtureDirectory = path.resolve("tests/assets/logos");

async function prepareFixture(filename: string): Promise<PixelImage> {
  const decoded = await sharp(path.join(fixtureDirectory, filename))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return prepareArtworkPixels({
    data: new Uint8ClampedArray(decoded.data),
    width: decoded.info.width,
    height: decoded.info.height,
  });
}

const raster = (
  pixels: ReadonlyArray<readonly [number, number, number, number]>,
): RasterPixels => ({
  data: new Uint8ClampedArray(pixels.flat()),
  width: pixels.length,
  height: 1,
});

describe("monochrome artwork", () => {
  it("preserves transparent and anti-aliased alpha exactly", () => {
    const source = raster([
      [200, 20, 40, 0],
      [200, 20, 40, 48],
      [20, 60, 200, 180],
      [50, 50, 50, 255],
    ]);
    const result = createMonochromePixels(source, "#123456");
    expect(result.width).toBe(source.width);
    expect(result.height).toBe(source.height);
    expect([result.data[3], result.data[7], result.data[11], result.data[15]]).toEqual([
      0, 48, 180, 255,
    ]);
    expect([...result.data.slice(0, 3)]).toEqual([200, 20, 40]);
  });

  it.each([
    ["black", PRINT_COLOURS.black],
    ["blue", PRINT_COLOURS.blue],
    ["green", PRINT_COLOURS.green],
  ])("converts every visible pixel to configured %s", (_name, colour) => {
    const source = raster([
      [220, 20, 40, 255],
      [20, 80, 210, 120],
      [90, 90, 90, 255],
    ]);
    const result = createMonochromePixels(source, colour);
    const expected = hexToRgb(colour);
    for (let offset = 0; offset < result.data.length; offset += 4) {
      expect([...result.data.slice(offset, offset + 3)]).toEqual(expected);
    }
  });

  it("does not invent opacity while recolouring prepared pixels", () => {
    const source = raster([
      [255, 255, 255, 0],
      [248, 248, 247, 0],
      [120, 120, 120, 255],
    ]);
    const result = createMonochromePixels(source, PRINT_COLOURS.green);
    expect([...result.data.slice(0, 3)]).toEqual([255, 255, 255]);
    expect([...result.data.slice(4, 7)]).toEqual([248, 248, 247]);
    expect([...result.data.slice(8, 11)]).toEqual(hexToRgb(PRINT_COLOURS.green));
    expect([result.data[3], result.data[7], result.data[11]]).toEqual([
      0, 0, 255,
    ]);
  });

  it("ignores transparent and near-white pixels when detecting colour", () => {
    const result = detectDominantBrandColour(
      raster([
        ...Array.from({ length: 20 }, () => [255, 255, 255, 255] as const),
        ...Array.from({ length: 20 }, () => [0, 80, 220, 0] as const),
        ...Array.from({ length: 10 }, () => [225, 0, 70, 255] as const),
      ]),
    );
    expect(result.confident).toBe(true);
    expect(result.hex).toBe("#E10046");
  });

  it("prefers a meaningful red cluster over more dark neutral text", () => {
    const result = detectDominantBrandColour(
      raster([
        ...Array.from({ length: 70 }, () => [55, 55, 55, 255] as const),
        ...Array.from({ length: 30 }, () => [230, 0, 70, 255] as const),
      ]),
    );
    expect(result.confident).toBe(true);
    expect(result.hex).toBe("#E60046");
  });

  it("falls back to black for neutral-only or low-confidence colour", () => {
    const neutral = detectDominantBrandColour(
      raster(Array.from({ length: 30 }, () => [35, 35, 35, 255])),
    );
    const weak = detectDominantBrandColour(
      raster([
        ...Array.from({ length: 100 }, () => [30, 30, 30, 255] as const),
        ...Array.from({ length: 2 }, () => [230, 0, 70, 255] as const),
      ]),
    );
    expect(neutral).toMatchObject({ hex: "#000000", confident: false });
    expect(weak).toMatchObject({ hex: "#000000", confident: false });
  });

  it.each([
    ["DiellArt", "pdf-logo-diellart.png"],
    ["Xh’Aura", "Xh'Aura.jpeg"],
    ["EC Analytics", "EC.png"],
  ])(
    "%s preserves every prepared alpha value and foreground position for all print colours",
    async (_label, filename) => {
      const prepared = await prepareFixture(filename);

      for (const colour of Object.values(PRINT_COLOURS)) {
        const monochrome = createMonochromePixels(prepared, colour);
        expect(monochrome.width).toBe(prepared.width);
        expect(monochrome.height).toBe(prepared.height);
        let alphaMismatches = 0;
        let preparedForegroundCount = 0;
        let monochromeForegroundCount = 0;
        for (let offset = 3; offset < prepared.data.length; offset += 4) {
          const preparedPixelAlpha = prepared.data[offset];
          const monochromePixelAlpha = monochrome.data[offset];
          if (preparedPixelAlpha !== monochromePixelAlpha) alphaMismatches++;
          if (preparedPixelAlpha !== 0) preparedForegroundCount++;
          if (monochromePixelAlpha !== 0) monochromeForegroundCount++;
        }
        expect(alphaMismatches).toBe(0);
        expect(monochromeForegroundCount).toBe(preparedForegroundCount);
      }
    },
  );
});
