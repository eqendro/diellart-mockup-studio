import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  prepareArtworkPixels,
  type PixelImage,
} from "../../src/features/logo-engine/preparation/process-pixels";
import { createMonochromePixels } from "../../src/features/logo-engine/monochrome/pixels";

const fixtureDirectory = path.resolve("tests/assets/logos");

async function readFixture(filename: string): Promise<PixelImage> {
  const decoded = await sharp(path.join(fixtureDirectory, filename))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8ClampedArray(decoded.data),
    width: decoded.info.width,
    height: decoded.info.height,
  };
}

function metrics(image: PixelImage, alphaThreshold = 10) {
  let foreground = 0;
  let transparent = 0;
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      if (alpha <= alphaThreshold) transparent++;
      if (alpha > alphaThreshold) {
        foreground++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return {
    size: `${image.width}x${image.height}`,
    foregroundPercent: foreground / (image.width * image.height),
    transparentPercent: transparent / (image.width * image.height),
    bounds: maxX >= 0 ? { minX, minY, maxX, maxY } : null,
  };
}

describe("supplied logo fixtures", () => {
  it.each(["Xh'Aura.jpeg", "EC.png", "pdf-logo-diellart.png"])(
    "prepares %s as foreground-only artwork",
    async (filename) => {
      const original = await readFixture(filename);
      const prepared = prepareArtworkPixels(original);
      console.info(filename, {
        original: metrics(original),
        prepared: metrics(prepared),
        classification: prepared.backgroundClassification,
        diagnostics: prepared.diagnostics,
      });
      expect(prepared.width).toBeGreaterThan(0);
      expect(prepared.height).toBeGreaterThan(0);
      expect(prepared.diagnostics.validationPassed).toBe(true);
      expect(prepared.diagnostics.paddingApplied).toBeLessThanOrEqual(20);
      expect(prepared.diagnostics.transparentPercent).toBeGreaterThan(
        filename === "EC.png" ? 0.5 : 0.75,
      );
      expect(prepared.foregroundBounds.width).toBeLessThan(prepared.width);
      expect(prepared.foregroundBounds.height).toBeLessThan(prepared.height);
    },
  );

  it("prepares a confirmed Xh'Aura crop without a residual white rectangle", async () => {
    const source = await sharp(path.join(fixtureDirectory, "Xh'Aura.jpeg"))
      .extract({ left: 205, top: 307, width: 614, height: 922 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const prepared = prepareArtworkPixels({
      data: new Uint8ClampedArray(source.data),
      width: source.info.width,
      height: source.info.height,
    });
    expect(prepared.backgroundRemoved).toBe(true);
    expect(prepared.diagnostics.validationPassed).toBe(true);
    expect(prepared.diagnostics.transparentPercent).toBeGreaterThan(0.75);
    expect(prepared.foregroundBounds.width).toBeLessThan(prepared.width);
    expect(prepared.foregroundBounds.height).toBeLessThan(prepared.height);
  });

  it("preserves Xh’Aura enclosed white counters through monochrome conversion", async () => {
    const prepared = prepareArtworkPixels(await readFixture("Xh'Aura.jpeg"));
    const monochrome = createMonochromePixels(prepared, "#00843D");
    let protectedCounterPixels = 0;
    for (let offset = 0; offset < prepared.data.length; offset += 4) {
      if (
        prepared.data[offset + 3] > 0 &&
        prepared.data[offset] >= 242 &&
        prepared.data[offset + 1] >= 242 &&
        prepared.data[offset + 2] >= 242
      ) {
        protectedCounterPixels++;
        expect([...monochrome.data.slice(offset, offset + 4)]).toEqual(
          [...prepared.data.slice(offset, offset + 4)],
        );
      }
    }
    expect(protectedCounterPixels).toBeGreaterThan(100);
  });

  it("retains both neutral EC lettering and red Analytics lettering", async () => {
    const prepared = prepareArtworkPixels(await readFixture("EC.png"));
    let neutralForeground = 0;
    let redForeground = 0;
    for (let offset = 0; offset < prepared.data.length; offset += 4) {
      if (prepared.data[offset + 3] <= 8) continue;
      const red = prepared.data[offset];
      const green = prepared.data[offset + 1];
      const blue = prepared.data[offset + 2];
      if (Math.max(red, green, blue) - Math.min(red, green, blue) <= 20 &&
          red < 200) neutralForeground++;
      if (red > 150 && red > green * 2 && red > blue * 1.5) redForeground++;
    }
    expect(neutralForeground).toBeGreaterThan(200);
    expect(redForeground).toBeGreaterThan(1_000);
  });
});
