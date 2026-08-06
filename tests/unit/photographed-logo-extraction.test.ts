import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  analyseExtractionInput,
  extractLogoPixels,
  scoreExtractionCandidate,
  validateExtractedLogo,
  type ExtractionMode,
} from "../../src/features/artwork-intake/extract-logo";
import type { PixelImage } from "../../src/features/logo-engine/preparation/process-pixels";

const fixtureDirectory = path.resolve("tests/assets/artwork-regression");

async function crop(filename: string, area: { left: number; top: number; width: number; height: number }): Promise<PixelImage> {
  const decoded = await sharp(path.join(fixtureDirectory, filename)).rotate().extract(area).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(decoded.data), width: decoded.info.width, height: decoded.info.height };
}

function candidates(input: PixelImage) {
  const metrics = analyseExtractionInput(input);
  const modes: ExtractionMode[] = [
    "dark-on-light", "light-on-dark", "dominant-saturated-colour", "selected-colour",
    "border-connected-background", "border-colour-distance",
  ];
  return modes.map((mode) => {
    const pixels = extractLogoPixels(input, mode, metrics.selectedForeground, metrics);
    const validation = validateExtractedLogo(pixels);
    return { mode, pixels, validation, score: scoreExtractionCandidate(validation, metrics), metrics };
  }).sort((a, b) => b.score - a.score);
}

function saturatedForeground(image: PixelImage) {
  let saturated = 0; let foreground = 0;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] <= 20) continue;
    foreground++;
    const maximum = Math.max(image.data[offset], image.data[offset + 1], image.data[offset + 2]);
    const minimum = Math.min(image.data[offset], image.data[offset + 1], image.data[offset + 2]);
    if (maximum > 100 && maximum - minimum > 45) saturated++;
  }
  return foreground ? saturated / foreground : 0;
}

function redForegroundPixels(image: PixelImage) {
  let red = 0;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] > 20 && image.data[offset] > 120 && image.data[offset] > image.data[offset + 1] * 1.35 && image.data[offset] > image.data[offset + 2] * 1.25) red++;
  }
  return red;
}

describe("real photographed logo extraction", () => {
  it("produces a transparent, non-rectangular saturated Vodafone candidate", async () => {
    const input = await crop("vodafone.jpg", { left: 370, top: 1450, width: 1500, height: 1350 });
    const ranked = candidates(input);
    console.info("Vodafone extraction diagnostics", ranked.map(({ mode, validation, score, metrics }) => ({ mode, validation, score, metrics })));
    const usable = ranked.find(({ validation, pixels }) => validation.valid && saturatedForeground(pixels) > 0.35);
    expect(usable).toBeDefined();
    expect(usable!.validation.transparencyRatio).toBeGreaterThan(0.35);
    expect(usable!.validation.rectangularity).toBeLessThan(0.8);
    expect(usable!.validation.boundsRatio).toBeLessThan(0.95);
    expect(redForegroundPixels(usable!.pixels)).toBeGreaterThan(10_000);
  });

  it("produces a reviewable Riviera wordmark candidate from a reasonable crop", async () => {
    const input = await crop("riviera-di-mare.jpg", { left: 390, top: 1650, width: 1500, height: 1150 });
    const ranked = candidates(input);
    console.info("Riviera extraction diagnostics", ranked.map(({ mode, validation, score, metrics }) => ({ mode, validation, score, metrics })));
    const usable = ranked.find(({ validation }) => validation.valid && validation.connectedComponentCount >= 4);
    expect(usable).toBeDefined();
    expect(usable!.validation.transparencyRatio).toBeGreaterThan(0.35);
    expect(usable!.validation.rectangularity).toBeLessThan(0.8);
    expect(usable!.validation.connectedComponentCount).toBeGreaterThanOrEqual(4);
    expect(usable!.score).toBeGreaterThan(0.45);
    expect(usable!.validation.bounds!.width / input.width).toBeGreaterThan(0.65);
    expect(usable!.validation.bounds!.height / input.height).toBeGreaterThan(0.3);
  });
});
