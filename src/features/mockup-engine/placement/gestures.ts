import {
  calculatePlacementLimits,
  clampPlacement,
} from "@/features/mockup-engine/placement/placement";
import type { ArtworkPlacement } from "@/features/mockup-engine/placement/types";
import type { ProductMockup } from "@/types/product-template";

export type Point = { x: number; y: number };

export const pointerDistance = (first: Point, second: Point) =>
  Math.hypot(second.x - first.x, second.y - first.y);

export const pointerMidpoint = (first: Point, second: Point): Point => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
});

export const pointerAngle = (first: Point, second: Point) =>
  (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI;

export function shortestAngleDelta(initial: number, current: number) {
  return ((current - initial + 540) % 360) - 180;
}

export function applyGestureDelta(input: {
  placement: ArtworkPlacement;
  deltaX: number;
  deltaY: number;
  safeWidth: number;
  safeHeight: number;
  mockup: ProductMockup;
  artworkAspectRatio: number;
  scale?: number;
}) {
  const scale = input.scale ?? input.placement.scale;
  const next = {
    scale,
    offsetX:
      input.placement.offsetX +
      (input.safeWidth > 0 ? input.deltaX / input.safeWidth : 0),
    offsetY:
      input.placement.offsetY +
      (input.safeHeight > 0 ? input.deltaY / input.safeHeight : 0),
    rotation: input.placement.rotation,
  };
  return clampPlacement(
    next,
    calculatePlacementLimits(scale, {
      mockup: input.mockup,
      artworkAspectRatio: input.artworkAspectRatio,
      rotation: input.placement.rotation,
    }),
  );
}

export function calculatePinchPlacement(input: {
  placement: ArtworkPlacement;
  initialDistance: number;
  currentDistance: number;
  midpointDeltaX: number;
  midpointDeltaY: number;
  safeWidth: number;
  safeHeight: number;
  mockup: ProductMockup;
  artworkAspectRatio: number;
  initialAngle?: number;
  currentAngle?: number;
}) {
  const ratio =
    input.initialDistance > 0
      ? input.currentDistance / input.initialDistance
      : 1;
  const rotation = input.initialAngle === undefined || input.currentAngle === undefined
    ? input.placement.rotation
    : input.placement.rotation + shortestAngleDelta(input.initialAngle, input.currentAngle);
  const moved = applyGestureDelta({
    ...input,
    placement: { ...input.placement, rotation },
    deltaX: input.midpointDeltaX,
    deltaY: input.midpointDeltaY,
    scale: input.placement.scale * ratio,
  });
  return clampPlacement(moved, calculatePlacementLimits(moved.scale, {
    mockup: input.mockup,
    artworkAspectRatio: input.artworkAspectRatio,
    rotation: moved.rotation,
  }));
}
