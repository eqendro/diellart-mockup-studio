import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { analyseArtworkPixels } from "../../src/features/artwork-intake";
import type { PixelImage } from "../../src/features/logo-engine/preparation/process-pixels";

const createImage = (
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number, number],
): PixelImage => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  }
  return { data, width, height };
};

async function fixture(filename: string): Promise<PixelImage> {
  const decoded = await sharp(path.resolve("tests/assets/logos", filename))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8ClampedArray(decoded.data),
    width: decoded.info.width,
    height: decoded.info.height,
  };
}

describe("Artwork Intake Engine", () => {
  it("classifies a transparent PNG as TransparentLogo", async () => {
    expect(analyseArtworkPixels(await fixture("pdf-logo-diellart.png"))).toMatchObject({
      classification: "TransparentLogo",
      recommendedWorkflow: "NoPreparation",
    });
  });

  it.each(["Xh'Aura.jpeg", "EC.png"])(
    "classifies plain-background logo fixture %s",
    async (filename) => {
      expect(analyseArtworkPixels(await fixture(filename))).toMatchObject({
        classification: "LogoOnPlainBackground",
        recommendedWorkflow: "BackgroundRemoval",
      });
    },
  );

  it("classifies photograph-like colour and detail", () => {
    const photo = createImage(180, 120, (x, y) => [
      (x * 17 + y * 31) % 256,
      (x * 43 + y * 13) % 256,
      (x * 7 + y * 53) % 256,
      255,
    ]);
    expect(analyseArtworkPixels(photo)).toMatchObject({
      classification: "Photograph",
      recommendedWorkflow: "CropRequired",
      requiresCrop: true,
    });
  });

  it("classifies a screen-like grid as Screenshot", () => {
    const screenshot = createImage(160, 100, (x, y) => {
      if (y < 12) return [35, 45, 58, 255];
      if (x % 28 < 2 || y % 22 < 2) return [225, 80, 70, 255];
      return [(x * 3) % 180, (y * 5) % 180, 205, 255];
    });
    const result = analyseArtworkPixels(screenshot);
    expect(result.classification).toBe("Screenshot");
  });

  it("classifies a presentation-shaped page as Document", () => {
    const document = createImage(160, 90, (x, y) => {
      const line = y > 20 && y < 70 && y % 10 < 2 && x > 20 && x < 125;
      return line ? [35, 45, 55, 255] : [250, 249, 247, 255];
    });
    expect(analyseArtworkPixels(document)).toMatchObject({
      classification: "Document",
      recommendedWorkflow: "CropRequired",
    });
  });

  it("classifies an uninformative image as Unknown", () => {
    const unknown = createImage(80, 80, () => [90, 70, 110, 255]);
    expect(analyseArtworkPixels(unknown)).toMatchObject({
      classification: "Unknown",
      confidence: "Low",
      recommendedWorkflow: "ManualReview",
    });
  });
});
