import { describe, expect, it } from "vitest";
import { pocketPaperProductView } from "../../src/config/products/pocket-paper";
import {
  applyGestureDelta,
  calculatePinchPlacement,
  calculatePlacementLimits,
  DEFAULT_PLACEMENT,
} from "../../src/features/mockup-engine/placement";

const geometry = {
  mockup: pocketPaperProductView,
  artworkAspectRatio: 2,
  safeWidth: 400,
  safeHeight: 600,
};

describe("placement gestures", () => {
  it("converts pointer pixels into normalized safe-area offsets", () => {
    const next = applyGestureDelta({
      ...geometry,
      placement: { scale: 0.5, offsetX: 0, offsetY: 0 },
      deltaX: 40,
      deltaY: -60,
    });
    expect(next.offsetX).toBeCloseTo(0.1);
    expect(next.offsetY).toBeCloseTo(-0.1);
  });

  it("clamps drag movement to the geometry limits", () => {
    const placement = { scale: 0.5, offsetX: 0, offsetY: 0 };
    const next = applyGestureDelta({
      ...geometry,
      placement,
      deltaX: 10_000,
      deltaY: -10_000,
    });
    const limits = calculatePlacementLimits(placement.scale, geometry);
    expect(next.offsetX).toBe(limits.maximumOffsetX);
    expect(next.offsetY).toBe(limits.minimumOffsetY);
  });

  it("enlarges and reduces by the pinch-distance ratio", () => {
    const enlarged = calculatePinchPlacement({
      ...geometry,
      placement: { scale: 0.5, offsetX: 0, offsetY: 0 },
      initialDistance: 100,
      currentDistance: 150,
      midpointDeltaX: 0,
      midpointDeltaY: 0,
    });
    const reduced = calculatePinchPlacement({
      ...geometry,
      placement: enlarged,
      initialDistance: 100,
      currentDistance: 50,
      midpointDeltaX: 0,
      midpointDeltaY: 0,
    });
    expect(enlarged.scale).toBeCloseTo(0.75);
    expect(reduced.scale).toBeCloseTo(0.375);
  });

  it("clamps pinch scale at both configured limits", () => {
    const minimum = calculatePinchPlacement({
      ...geometry,
      placement: DEFAULT_PLACEMENT,
      initialDistance: 100,
      currentDistance: 1,
      midpointDeltaX: 0,
      midpointDeltaY: 0,
    });
    const maximum = calculatePinchPlacement({
      ...geometry,
      placement: DEFAULT_PLACEMENT,
      initialDistance: 100,
      currentDistance: 1000,
      midpointDeltaX: 0,
      midpointDeltaY: 0,
    });
    expect(minimum.scale).toBe(0.35);
    expect(maximum.scale).toBe(1);
  });

  it("reclamps position after pinch scaling and follows its midpoint", () => {
    const next = calculatePinchPlacement({
      ...geometry,
      placement: { scale: 0.5, offsetX: 0.4, offsetY: -0.4 },
      initialDistance: 100,
      currentDistance: 200,
      midpointDeltaX: 40,
      midpointDeltaY: 60,
    });
    const limits = calculatePlacementLimits(next.scale, geometry);
    expect(next.offsetX).toBeLessThanOrEqual(limits.maximumOffsetX);
    expect(next.offsetY).toBeGreaterThanOrEqual(limits.minimumOffsetY);
  });
});
