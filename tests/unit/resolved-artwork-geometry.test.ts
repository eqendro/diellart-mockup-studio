import { describe, expect, it } from "vitest";
import { resolveArtworkGeometry } from "../../src/features/mockup-engine/utils/resolve-artwork-geometry";
import type { PrintableArtwork } from "../../src/features/logo-engine/types/artwork";

const artwork = (canvasWidth: number, canvasHeight: number): PrintableArtwork => ({
  url: "blob:test",
  filename: "test.png",
  width: canvasWidth,
  height: canvasHeight,
  aspectRatio: 2,
  veryLight: false,
  canvasWidth,
  canvasHeight,
  foregroundBounds: { x: 10, y: 5, width: 100, height: 50 },
});

describe("resolved artwork geometry", () => {
  it.each([
    ["wide", 220, 80],
    ["tall", 80, 220],
    ["square", 160, 160],
  ])("preserves the intrinsic %s canvas ratio", (_name, width, height) => {
    const resolved = resolveArtworkGeometry(
      { x: 50, y: 70, width: 200, height: 100 },
      artwork(width, height),
      { scale: 0.88, offsetX: 0.1, offsetY: -0.1 },
    );
    expect(resolved.width / resolved.height).toBeCloseTo(width / height, 12);
    expect(resolved.scale).toBe(0.88);
    expect(resolved.offsetX).toBe(0.1);
    expect(resolved.offsetY).toBe(-0.1);
  });

  it("uses one uniform source-pixel scale for both axes", () => {
    const resolved = resolveArtworkGeometry(
      // Deliberately inconsistent fit height proves it cannot create scaleY.
      { x: 50, y: 70, width: 200, height: 75 },
      artwork(220, 80),
      { scale: 0.7, offsetX: 0, offsetY: 0 },
    );
    expect(resolved.width).toBe(440);
    expect(resolved.height).toBe(160);
    expect(resolved.width / 220).toBe(resolved.height / 80);
  });
});
