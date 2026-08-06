export {
  calculatePlacementLimits,
  centrePlacement,
  clampPlacement,
  DEFAULT_PLACEMENT,
  PLACEMENT_SCALE_LIMITS,
  getSemanticSizeLabel,
  movePlacement,
  resizePlacement,
  rotatePlacement,
  resetPlacement,
} from "@/features/mockup-engine/placement/placement";
export type {
  ArtworkPlacement,
  PlacementLimits,
} from "@/features/mockup-engine/placement/types";
export type { PlacementDirection } from "@/features/mockup-engine/placement/placement";
export {
  applyGestureDelta,
  calculatePinchPlacement,
  pointerAngle,
  pointerDistance,
  pointerMidpoint,
  shortestAngleDelta,
} from "@/features/mockup-engine/placement/gestures";
export type { Point } from "@/features/mockup-engine/placement/gestures";
