import { describe, expect, it } from "vitest";
import { prepareArtworkPixels, type PixelImage } from "../../src/features/logo-engine/preparation/process-pixels";
import { detectForegroundBounds } from "../../src/features/logo-engine/preparation/process-pixels";

const image = (
  width: number,
  height: number,
  colour: [number, number, number, number],
): PixelImage => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index++) data.set(colour, index * 4);
  return { data, width, height };
};

const setPixel = (
  value: PixelImage,
  x: number,
  y: number,
  colour: [number, number, number, number],
) => value.data.set(colour, (y * value.width + x) * 4);

describe("prepareArtworkPixels", () => {
  it("reads dimensions inherited like browser ImageData getters", () => {
    const source = image(30, 30, [0, 0, 0, 0]);
    for (let y = 10; y < 20; y++)
      for (let x = 10; x < 20; x++) setPixel(source, x, y, [20, 30, 40, 255]);
    const browserLikeImageData = Object.create({
      width: source.width,
      height: source.height,
    }) as PixelImage;
    browserLikeImageData.data = source.data;

    const result = prepareArtworkPixels(browserLikeImageData);

    expect(result.width).toBe(22);
    expect(result.height).toBe(22);
  });

  it("preserves transparency and crops transparent PNG margins", () => {
    const source = image(30, 30, [0, 0, 0, 0]);
    for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) setPixel(source, x, y, [20, 30, 40, 255]);
    const result = prepareArtworkPixels(source);
    expect(result.backgroundRemoved).toBe(false);
    expect(result.marginsCropped).toBe(true);
    expect(result.width).toBeLessThan(30);
    expect(result.data[3]).toBe(0);
    expect(result.backgroundClassification).toBe("transparent");
    expect(result.diagnostics.validationPassed).toBe(true);
    expect(result.foregroundBounds).toEqual({ x: 6, y: 6, width: 10, height: 10 });
  });

  it("calculates foreground bounds only from alpha above the threshold", () => {
    const source = image(20, 20, [255, 255, 255, 5]);
    for (let y = 7; y < 13; y++) for (let x = 5; x < 15; x++) setPixel(source, x, y, [20, 30, 40, 255]);
    expect(detectForegroundBounds(source, 10)).toEqual({
      x: 5,
      y: 7,
      width: 10,
      height: 6,
    });
  });

  it("removes a near-white JPG-style background", () => {
    const source = image(40, 40, [248, 248, 247, 255]);
    for (let y = 12; y < 28; y++) for (let x = 12; x < 28; x++) setPixel(source, x, y, [170, 20, 30, 255]);
    const result = prepareArtworkPixels(source);
    expect(result.backgroundRemoved).toBe(true);
    expect([...result.data].filter((_, index) => index % 4 === 3 && result.data[index] === 0).length).toBeGreaterThan(0);
  });

  it("removes faint-grey edge-connected backgrounds without a residual card", () => {
    const source = image(48, 48, [229, 231, 230, 255]);
    for (let y = 14; y < 34; y++) for (let x = 14; x < 34; x++) setPixel(source, x, y, [20, 90, 170, 255]);
    const result = prepareArtworkPixels(source);
    expect(result.backgroundClassification).toBe("removable-light-background");
    expect(result.width).toBeLessThan(48);
    expect(result.height).toBeLessThan(48);
  });

  it("removes a warm off-white background estimated from border segments", () => {
    const source = image(44, 44, [244, 235, 225, 255]);
    for (let y = 13; y < 31; y++) for (let x = 13; x < 31; x++) setPixel(source, x, y, [45, 70, 120, 255]);
    const result = prepareArtworkPixels(source);
    expect(result.backgroundRemoved).toBe(true);
    expect(result.backgroundClassification).toBe("removable-light-background");
    expect(result.width).toBeLessThan(44);
  });

  it("reduces light boundary colour contamination", () => {
    const source = image(36, 36, [255, 255, 255, 255]);
    for (let y = 10; y < 26; y++) for (let x = 10; x < 26; x++) setPixel(source, x, y, [150, 190, 240, 255]);
    const before = source.data[(12 * source.width + 10) * 4];
    const result = prepareArtworkPixels(source);
    const coloured = [...result.data].findIndex((value, index) => index % 4 === 0 && value > 0 && result.data[index + 2] > value);
    expect(result.backgroundRemoved).toBe(true);
    expect(coloured).toBeGreaterThanOrEqual(0);
    expect(result.data[coloured]).toBeLessThanOrEqual(before);
  });

  it("classifies pale retained artwork for a visible rendering fallback", () => {
    const source = image(30, 30, [0, 0, 0, 0]);
    for (let y = 8; y < 22; y++) for (let x = 8; x < 22; x++) setPixel(source, x, y, [242, 242, 238, 255]);
    expect(prepareArtworkPixels(source).veryLight).toBe(true);
  });

  it("keeps internal white details disconnected from the edge", () => {
    const source = image(40, 40, [255, 255, 255, 255]);
    for (let y = 8; y < 32; y++) for (let x = 8; x < 32; x++) setPixel(source, x, y, [15, 15, 15, 255]);
    for (let y = 16; y < 24; y++) for (let x = 16; x < 24; x++) setPixel(source, x, y, [255, 255, 255, 255]);
    const result = prepareArtworkPixels(source);
    const centre = ((result.height / 2 | 0) * result.width + (result.width / 2 | 0)) * 4;
    expect(result.backgroundRemoved).toBe(true);
    expect(result.data[centre + 3]).toBe(255);
  });

  it("does not remove a non-white photographic border", () => {
    const source = image(32, 32, [80, 120, 160, 255]);
    for (let x = 0; x < 32; x++) setPixel(source, x, 0, [x * 6, 90, 130, 255]);
    const result = prepareArtworkPixels(source);
    expect(result.backgroundRemoved).toBe(false);
    expect(result.data[3]).toBe(255);
  });
});
