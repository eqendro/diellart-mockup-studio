import { describe, expect, it } from "vitest";
import { pocketPaperProductView } from "../../src/config/products/pocket-paper";
import { calculateLogoFit } from "../../src/features/mockup-engine/utils/calculate-logo-fit";
import { calculatePlacementLimits } from "../../src/features/mockup-engine/placement";

const fit = (aspectRatio: number) =>
  calculateLogoFit({
    mockupWidth: 1024,
    mockupHeight: 1536,
    productBounds: pocketPaperProductView.productBounds,
    surface: pocketPaperProductView.surface,
    safeMargins: pocketPaperProductView.surface.safeMargins,
    logoAspectRatio: aspectRatio,
    fitProfile: pocketPaperProductView.fitProfile,
  });

describe("calculateLogoFit", () => {
  it.each([
    ["wide", 4],
    ["tall", 0.25],
    ["square", 1],
  ])("keeps a %s logo inside the configured safe area", (_name, ratio) => {
    const result = fit(ratio);
    const product = pocketPaperProductView.productBounds;
    const surface = pocketPaperProductView.surface;
    const safeX = (product.x + product.width * (surface.x + surface.width * surface.safeMargins.horizontal)) * 1024;
    const safeY = (product.y + product.height * (surface.y + surface.height * surface.safeMargins.vertical)) * 1536;
    const safeWidth = product.width * surface.width * (1 - 2 * surface.safeMargins.horizontal) * 1024;
    const safeHeight = product.height * surface.height * (1 - 2 * surface.safeMargins.vertical) * 1536;
    expect(result.x).toBeGreaterThanOrEqual(safeX - 0.001);
    expect(result.y).toBeGreaterThanOrEqual(safeY - 0.001);
    expect(result.x + result.width).toBeLessThanOrEqual(safeX + safeWidth + 0.001);
    expect(result.y + result.height).toBeLessThanOrEqual(safeY + safeHeight + 0.001);
    expect(result.width / result.height).toBeCloseTo(ratio);
  });

  it.each([
    ["wide", 4],
    ["tall", 0.25],
    ["square", 1],
  ])("keeps manually positioned %s artwork inside the safe area", (_name, ratio) => {
    const scale = 0.55;
    const limits = calculatePlacementLimits(scale, {
      mockup: pocketPaperProductView,
      artworkAspectRatio: ratio,
    });
    const result = calculateLogoFit({
      mockupWidth: 1024,
      mockupHeight: 1536,
      productBounds: pocketPaperProductView.productBounds,
      surface: pocketPaperProductView.surface,
      safeMargins: pocketPaperProductView.surface.safeMargins,
      logoAspectRatio: ratio,
      fitProfile: pocketPaperProductView.fitProfile,
      scaleMultiplier: scale,
      offsetX: limits.maximumOffsetX,
      offsetY: limits.minimumOffsetY,
    });
    const product = pocketPaperProductView.productBounds;
    const surface = pocketPaperProductView.surface;
    const safeX = (product.x + product.width * (surface.x + surface.width * surface.safeMargins.horizontal)) * 1024;
    const safeY = (product.y + product.height * (surface.y + surface.height * surface.safeMargins.vertical)) * 1536;
    const safeWidth = product.width * surface.width * (1 - 2 * surface.safeMargins.horizontal) * 1024;
    const safeHeight = product.height * surface.height * (1 - 2 * surface.safeMargins.vertical) * 1536;
    expect(result.x).toBeGreaterThanOrEqual(safeX - 0.001);
    expect(result.y).toBeGreaterThanOrEqual(safeY - 0.001);
    expect(result.x + result.width).toBeLessThanOrEqual(safeX + safeWidth + 0.001);
    expect(result.y + result.height).toBeLessThanOrEqual(safeY + safeHeight + 0.001);
  });
});
