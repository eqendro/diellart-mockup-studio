import { describe, expect, it } from "vitest";
import { suggestArtworkCrop } from "../../src/features/artwork-intake/suggest-crop";

describe("smart crop suggestion", () => {
  it("moves the starting selection around probable artwork with padding", () => {
    const width = 100;
    const height = 80;
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    for (let y = 25; y < 55; y += 1) {
      for (let x = 30; x < 70; x += 1) {
        const index = (y * width + x) * 4;
        pixels[index] = 20;
        pixels[index + 1] = 20;
        pixels[index + 2] = 20;
      }
    }
    const suggestion = suggestArtworkCrop(pixels, width, height);
    expect(suggestion).not.toBeNull();
    expect(suggestion!.x).toBeLessThan(30);
    expect(suggestion!.y).toBeLessThan(31.25);
    expect(suggestion!.x + suggestion!.width).toBeGreaterThan(70);
    expect(suggestion!.y + suggestion!.height).toBeGreaterThan(68.75);
  });

  it("keeps the neutral crop when no probable foreground exists", () => {
    expect(suggestArtworkCrop(new Uint8ClampedArray(20 * 20 * 4).fill(255), 20, 20)).toBeNull();
  });
});
