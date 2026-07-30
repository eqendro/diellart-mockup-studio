import { describe, expect, it } from "vitest";
import {
  cleanupResidualNoise,
} from "../../src/features/logo-engine/preparation/residual-noise-cleanup";
import type { RasterPixels } from "../../src/features/logo-engine/monochrome/pixels";

const canvas = (width = 100, height = 100): RasterPixels => ({
  data: new Uint8ClampedArray(width * height * 4),
  width,
  height,
});

const pixel = (
  image: RasterPixels,
  x: number,
  y: number,
  rgba: [number, number, number, number] = [12, 34, 56, 255],
) => image.data.set(rgba, (y * image.width + x) * 4);

const rect = (
  image: RasterPixels,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  for (let row = y; row < y + height; row++)
    for (let column = x; column < x + width; column++)
      pixel(image, column, row);
};

describe("residual noise cleanup", () => {
  it("removes isolated one-pixel and 2×2 specks without mutating input", () => {
    const source = canvas();
    rect(source, 35, 35, 30, 30);
    pixel(source, 2, 2, [80, 90, 100, 64]);
    rect(source, 94, 94, 2, 2);
    const before = new Uint8ClampedArray(source.data);
    const result = cleanupResidualNoise(source);
    expect(result.removedComponentCount).toBe(2);
    expect(result.removedPixelCount).toBe(5);
    expect(result.image.width).toBe(source.width);
    expect(result.image.height).toBe(source.height);
    expect(source.data).toEqual(before);
    expect(result.image.data[(2 * 100 + 2) * 4 + 3]).toBe(0);
    expect(result.image.data[(40 * 100 + 40) * 4 + 3]).toBe(255);
  });

  it("only subtracts alpha and preserves every retained RGBA byte", () => {
    const source = canvas();
    rect(source, 30, 30, 40, 40);
    pixel(source, 1, 1, [101, 102, 103, 77]);
    const result = cleanupResidualNoise(source);
    for (let offset = 0; offset < source.data.length; offset += 4) {
      const before = [...source.data.slice(offset, offset + 4)];
      const after = [...result.image.data.slice(offset, offset + 4)];
      if (before[3] > 0 && after[3] === 0) {
        expect(after.slice(0, 3)).toEqual(before.slice(0, 3));
      } else {
        expect(after).toEqual(before);
      }
    }
  });

  it.each([
    ["apostrophe", [[49, 24]]],
    ["quotation marks", [[47, 24], [52, 24]]],
    ["i dot", [[45, 27]]],
    ["j dot", [[55, 27]]],
    ["registered mark", [[72, 28], [73, 28]]],
    ["decorative rays", [[42, 25], [50, 22], [58, 25]]],
    ["aligned punctuation", [[43, 75], [50, 75], [57, 75]]],
  ])("preserves %s close to or repeated around artwork", (_label, points) => {
    const source = canvas();
    rect(source, 35, 30, 30, 40);
    for (const [x, y] of points) pixel(source, x, y);
    expect(cleanupResidualNoise(source).changed).toBe(false);
  });

  it("preserves thin rules, narrow details, icons, and multiple components", () => {
    const source = canvas();
    rect(source, 15, 45, 20, 10);
    rect(source, 42, 49, 25, 1);
    rect(source, 75, 42, 8, 16);
    pixel(source, 38, 48);
    expect(cleanupResidualNoise(source).changed).toBe(false);
  });

  it("preserves transparent counters and never fills transparency", () => {
    const source = canvas();
    rect(source, 30, 20, 40, 60);
    rect(source, 40, 30, 20, 15);
    rect(source, 40, 55, 20, 15);
    for (let y = 30; y < 45; y++)
      for (let x = 40; x < 60; x++)
        source.data[(y * 100 + x) * 4 + 3] = 0;
    for (let y = 55; y < 70; y++)
      for (let x = 40; x < 60; x++)
        source.data[(y * 100 + x) * 4 + 3] = 0;
    const result = cleanupResidualNoise(source);
    expect(result.changed).toBe(false);
    expect(result.image.data[(35 * 100 + 50) * 4 + 3]).toBe(0);
    expect(result.image.data[(60 * 100 + 50) * 4 + 3]).toBe(0);
  });

  it("bypasses disabled, empty, single-component, invalid, and ambiguous images", () => {
    const empty = canvas();
    expect(cleanupResidualNoise(empty).changed).toBe(false);
    const single = canvas();
    rect(single, 40, 40, 20, 20);
    expect(cleanupResidualNoise(single).changed).toBe(false);
    expect(cleanupResidualNoise(single, { enabled: false }).changed).toBe(false);
    const ambiguous = canvas(10, 10);
    pixel(ambiguous, 1, 1);
    pixel(ambiguous, 8, 8);
    expect(cleanupResidualNoise(ambiguous).changed).toBe(false);
    const invalid = { data: new Uint8ClampedArray(3), width: 10, height: 10 };
    expect(cleanupResidualNoise(invalid).changed).toBe(false);
  });

  it("is deterministic and idempotent", () => {
    const source = canvas();
    rect(source, 35, 35, 30, 30);
    pixel(source, 2, 2);
    const first = cleanupResidualNoise(source);
    const second = cleanupResidualNoise(first.image);
    expect(second.image.data).toEqual(first.image.data);
    expect(cleanupResidualNoise(source)).toEqual(first);
  });
});
