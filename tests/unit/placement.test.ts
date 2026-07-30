import { describe, expect, it } from "vitest";
import {
  calculatePlacementLimits,
  centrePlacement,
  clampPlacement,
  DEFAULT_PLACEMENT,
  getSemanticSizeLabel,
  movePlacement,
  PLACEMENT_SCALE_LIMITS,
  resetPlacement,
} from "../../src/features/mockup-engine/placement";
import { pocketPaperProductView } from "../../src/config/products/pocket-paper";

describe("artwork placement", () => {
  it("starts with the recommended fit centred", () => {
    expect(DEFAULT_PLACEMENT).toEqual({ scale: 0.88, offsetX: 0, offsetY: 0 });
    expect(getSemanticSizeLabel(DEFAULT_PLACEMENT.scale)).toBe("Recommended");
  });

  it("clamps scale to the configured safe minimum and maximum", () => {
    expect(clampPlacement({ scale: 0, offsetX: 0, offsetY: 0 }).scale).toBe(
      PLACEMENT_SCALE_LIMITS.minimum,
    );
    expect(clampPlacement({ scale: 2, offsetX: 0, offsetY: 0 }).scale).toBe(
      PLACEMENT_SCALE_LIMITS.maximum,
    );
  });

  it("recalculates horizontal and vertical travel when scale changes", () => {
    const geometry = { mockup: pocketPaperProductView, artworkAspectRatio: 2 };
    const large = calculatePlacementLimits(1, geometry);
    const small = calculatePlacementLimits(0.5, geometry);
    expect(large.maximumOffsetX).toBeGreaterThanOrEqual(0);
    expect(large.maximumOffsetY).toBeGreaterThanOrEqual(0);
    expect(small.maximumOffsetX).toBeGreaterThan(large.maximumOffsetX);
    expect(small.maximumOffsetY).toBeGreaterThan(large.maximumOffsetY);
  });

  it("clamps both offsets to the current scale's travel", () => {
    expect(clampPlacement({ scale: 0.5, offsetX: 1, offsetY: -1 })).toEqual({
      scale: 0.5,
      offsetX: 0.5,
      offsetY: -0.5,
    });
  });

  it("reset restores automatic fit and centre", () => {
    expect(resetPlacement()).toEqual(DEFAULT_PLACEMENT);
    expect(resetPlacement()).not.toBe(DEFAULT_PLACEMENT);
  });

  it.each([
    ["left", "offsetX", -1],
    ["right", "offsetX", 1],
    ["up", "offsetY", -1],
    ["down", "offsetY", 1],
  ] as const)("moves %s in a bounded geometry-relative step", (direction, axis, sign) => {
    const limits = calculatePlacementLimits(DEFAULT_PLACEMENT.scale, {
      mockup: pocketPaperProductView,
      artworkAspectRatio: 1,
    });
    const moved = movePlacement(DEFAULT_PLACEMENT, direction, limits);
    expect(Math.sign(moved[axis])).toBe(sign);
    expect(moved.offsetX).toBeGreaterThanOrEqual(limits.minimumOffsetX);
    expect(moved.offsetX).toBeLessThanOrEqual(limits.maximumOffsetX);
    expect(moved.offsetY).toBeGreaterThanOrEqual(limits.minimumOffsetY);
    expect(moved.offsetY).toBeLessThanOrEqual(limits.maximumOffsetY);
  });

  it("centres offsets without changing the selected size", () => {
    expect(centrePlacement({ scale: 0.6, offsetX: 0.2, offsetY: -0.1 })).toEqual({
      scale: 0.6,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("maps internal precision to customer-friendly size language", () => {
    expect(getSemanticSizeLabel(0.5)).toBe("Smaller");
    expect(getSemanticSizeLabel(0.88)).toBe("Recommended");
    expect(getSemanticSizeLabel(1)).toBe("Larger");
  });
});
