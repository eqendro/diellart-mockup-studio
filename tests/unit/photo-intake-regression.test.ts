import { describe, expect, it } from "vitest";
import { extractLogoPixels, validateExtractedLogo } from "../../src/features/artwork-intake";
import { validateLogoFile } from "../../src/features/upload/utils/validate-logo-file";
import { calculateWorkingDimensions } from "../../src/features/upload/utils/decode-mobile-image";
import type { PixelImage } from "../../src/features/logo-engine/preparation/process-pixels";

const image = (
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number, number],
): PixelImage => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  return { data, width, height };
};

describe("mobile photo intake regressions", () => {
  it("accepts a camera JPEG even when Android supplies no extension", () => {
    const file = new File(["jpeg"], "image", { type: "image/jpeg" });
    expect(validateLogoFile(file)).toEqual({ valid: true, extension: "jpg" });
  });

  it("accepts Android's image/jpg MIME alias without an extension", () => {
    const file = new File(["jpeg"], "content-provider-image", { type: "image/jpg" });
    expect(validateLogoFile(file)).toEqual({ valid: true, extension: "jpg" });
  });

  it("accepts an empty MIME when a JPG extension is present", () => {
    expect(validateLogoFile(new File(["jpeg"], "1000101698.jpg"))).toEqual({ valid: true, extension: "jpg" });
  });

  it("normalises uppercase JPG extensions", () => {
    expect(validateLogoFile(new File(["jpeg"], "1000101698.JPG"))).toEqual({ valid: true, extension: "jpg" });
  });

  it("allows a non-empty provider file with inconclusive metadata to reach decoding", () => {
    expect(validateLogoFile(new File(["jpeg-bytes"], "1000101698"))).toEqual({ valid: true, extension: "image" });
  });

  it("downscales oversized mobile dimensions without changing aspect ratio", () => {
    expect(calculateWorkingDimensions(8000, 6000, 3200)).toEqual({ width: 3200, height: 2400, resized: true });
  });

  it("rejects zero decoded dimensions", () => {
    expect(() => calculateWorkingDimensions(0, 1200, 3200)).toThrow("ZERO_DIMENSION_IMAGE");
  });

  it("retains light/yellow lettering and removes a dark label", () => {
    const label = image(100, 60, (x, y) =>
      x > 25 && x < 75 && y > 20 && y < 40
        ? [245, 205, 20, 255]
        : [12, 14, 16, 255],
    );
    const extracted = extractLogoPixels(label, "light-on-dark");
    expect(extracted.data[(30 * 100 + 50) * 4 + 3]).toBeGreaterThan(200);
    expect(extracted.data[3]).toBe(0);
    expect(validateExtractedLogo(extracted).valid).toBe(true);
  });

  it("supports reversing foreground/background polarity", () => {
    const source = image(40, 40, (x, y) =>
      x > 10 && x < 30 && y > 10 && y < 30
        ? [20, 20, 20, 255]
        : [245, 245, 245, 255],
    );
    expect(extractLogoPixels(source, "dark-on-light").data[(20 * 40 + 20) * 4 + 3]).toBeGreaterThan(200);
    expect(extractLogoPixels(source, "light-on-dark").data[(20 * 40 + 20) * 4 + 3]).toBe(0);
  });

  it.each([
    [[0, 0, 0, 255] as [number, number, number, number]],
    [[205, 35, 90, 255] as [number, number, number, number]],
  ])("blocks a full opaque rectangle before rendering", (colour) => {
    expect(validateExtractedLogo(image(50, 30, () => colour)).valid).toBe(false);
  });

  it("does not reject a wide logo solely because it is wide", () => {
    const wide = image(120, 40, (x, y) =>
      x > 5 && x < 115 && y > 14 && y < 26
        ? [0, 0, 0, 255]
        : [255, 255, 255, 0],
    );
    expect(validateExtractedLogo(wide).valid).toBe(true);
  });
});
