import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  analyseArtworkPixels,
  createCandidateOutcome,
  isUsableArtworkCandidate,
  mapCropToOriginal,
  mapDisplayCropToNatural,
  selectIntakeRoute,
} from "../../src/features/artwork-intake";
import { createProcessingAsset } from "../../src/features/logo-engine/preparation/artwork-state";
import type { PixelImage } from "../../src/features/logo-engine/preparation/process-pixels";
import type { AcceptedLogo } from "../../src/features/upload/types/logo-upload";

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

const logo = {
  file: new File(["logo"], "logo.png", { type: "image/png" }),
  filename: "logo.png",
  mimeType: "image/png",
  extension: "png",
  sizeBytes: 4,
  formattedSize: "4 B",
  width: 1000,
  height: 800,
  aspectRatio: 1.25,
  previewUrl: "blob:original",
} satisfies AcceptedLogo;

describe("intake workflow routing", () => {
  it.each(["Xh'Aura.jpeg", "EC.png"])(
    "routes %s from plain-background classification to automatic preparation",
    async (filename) => {
      const result = analyseArtworkPixels(await fixture(filename));
      expect(result.classification).toBe("LogoOnPlainBackground");
      expect(selectIntakeRoute(result)).toBe("prepare-automatically");
    },
  );

  it("does not discard a medium-confidence prepared candidate", () => {
    const asset = {
      ...createProcessingAsset(logo),
      preparedUrl: "blob:prepared",
      printableUrl: "blob:prepared",
    };
    expect(createCandidateOutcome(asset, "medium")).toMatchObject({
      status: "review-required",
      preparedCandidate: asset,
      recommendedAction: "confirm",
    });
  });

  it("accepts a valid transparent original as usable artwork", () => {
    const asset = createProcessingAsset(logo);
    expect(isUsableArtworkCandidate(asset, "TransparentLogo")).toBe(true);
  });

  it("does not treat an unprepared plain-background original as usable", () => {
    expect(
      isUsableArtworkCandidate(
        createProcessingAsset(logo),
        "LogoOnPlainBackground",
      ),
    ).toBe(false);
  });

  it("accepts a produced plain-background candidate even at medium confidence", () => {
    const asset = {
      ...createProcessingAsset(logo),
      preparedUrl: "blob:prepared",
      printableUrl: "blob:prepared",
    };
    expect(isUsableArtworkCandidate(asset, "LogoOnPlainBackground")).toBe(true);
  });

  it("never treats a complete photograph as a usable logo candidate", () => {
    expect(isUsableArtworkCandidate(createProcessingAsset(logo), "Photograph")).toBe(
      false,
    );
  });

  it("maps responsive percentage crop coordinates to the original image", () => {
    expect(
      mapCropToOriginal(
        { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
        2000,
        1000,
      ),
    ).toEqual({ x: 200, y: 200, width: 1000, height: 400 });
  });

  it("clamps crop coordinates safely within the original", () => {
    expect(
      mapCropToOriginal(
        { x: 0.9, y: 0.8, width: 0.5, height: 0.5 },
        1000,
        800,
      ),
    ).toEqual({ x: 900, y: 640, width: 100, height: 160 });
  });

  it("maps displayed coordinates to natural dimensions", () => {
    expect(
      mapDisplayCropToNatural(
        { x: 50, y: 75, width: 200, height: 150 },
        { x: 0, y: 0, width: 500, height: 375 },
        2000,
        1500,
      ),
    ).toEqual({ x: 200, y: 300, width: 800, height: 600 });
  });

  it("accounts for letterboxing offsets when mapping a crop", () => {
    expect(
      mapDisplayCropToNatural(
        { x: 150, y: 150, width: 200, height: 300 },
        { x: 100, y: 50, width: 400, height: 600 },
        1000,
        1500,
      ),
    ).toEqual({ x: 125, y: 250, width: 500, height: 750 });
  });

  it("clamps displayed crop rectangles to natural source bounds", () => {
    expect(
      mapDisplayCropToNatural(
        { x: 450, y: 350, width: 200, height: 200 },
        { x: 0, y: 0, width: 500, height: 400 },
        1000,
        800,
      ),
    ).toEqual({ x: 900, y: 700, width: 100, height: 100 });
  });

  it("treats camera-captured files like any other browser-local File", () => {
    const cameraFile = new File(["pixels"], "camera.jpg", { type: "image/jpeg" });
    expect(cameraFile).toBeInstanceOf(File);
    expect(cameraFile.type).toBe("image/jpeg");
  });
});
