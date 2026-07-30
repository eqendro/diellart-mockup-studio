import type {
  ArtworkPlacement,
  PlacementLimits,
} from "@/features/mockup-engine/placement/types";
import { calculateLogoFit } from "@/features/mockup-engine/utils/calculate-logo-fit";
import type { ProductMockup } from "@/types/product-template";

export const DEFAULT_PLACEMENT: ArtworkPlacement = {
  scale: 0.88,
  offsetX: 0,
  offsetY: 0,
};

export const PLACEMENT_SCALE_LIMITS = {
  minimum: 0.35,
  maximum: 1,
  recommended: 0.88,
  movementStepRatio: 0.12,
} as const;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function calculatePlacementLimits(
  scale: number,
  geometry?: { mockup: ProductMockup; artworkAspectRatio: number },
): PlacementLimits {
  const safeScale = clamp(
    scale,
    PLACEMENT_SCALE_LIMITS.minimum,
    PLACEMENT_SCALE_LIMITS.maximum,
  );
  let horizontalTravel = 1 - safeScale;
  let verticalTravel = 1 - safeScale;
  if (geometry) {
    const width = geometry.mockup.intrinsicSize?.width ?? 1;
    const height = geometry.mockup.intrinsicSize?.height ?? 1;
    const fit = calculateLogoFit({
      mockupWidth: width,
      mockupHeight: height,
      productBounds: geometry.mockup.productBounds,
      surface: geometry.mockup.surface,
      safeMargins: geometry.mockup.surface.safeMargins,
      logoAspectRatio: geometry.artworkAspectRatio,
      scaleMultiplier: safeScale,
      fitProfile: geometry.mockup.fitProfile,
    });
    const safeWidth =
      geometry.mockup.productBounds.width *
      geometry.mockup.surface.width *
      (1 - geometry.mockup.surface.safeMargins.horizontal * 2) *
      width;
    const safeHeight =
      geometry.mockup.productBounds.height *
      geometry.mockup.surface.height *
      (1 - geometry.mockup.surface.safeMargins.vertical * 2) *
      height;
    horizontalTravel = safeWidth > 0 ? (safeWidth - fit.width) / 2 / safeWidth : 0;
    verticalTravel = safeHeight > 0 ? (safeHeight - fit.height) / 2 / safeHeight : 0;
  }
  return {
    minimumScale: PLACEMENT_SCALE_LIMITS.minimum,
    maximumScale: PLACEMENT_SCALE_LIMITS.maximum,
    minimumOffsetX: -horizontalTravel,
    maximumOffsetX: horizontalTravel,
    minimumOffsetY: -verticalTravel,
    maximumOffsetY: verticalTravel,
  };
}

export function clampPlacement(
  placement: ArtworkPlacement,
  limits = calculatePlacementLimits(placement.scale),
): ArtworkPlacement {
  return {
    scale: clamp(placement.scale, limits.minimumScale, limits.maximumScale),
    offsetX: clamp(placement.offsetX, limits.minimumOffsetX, limits.maximumOffsetX),
    offsetY: clamp(placement.offsetY, limits.minimumOffsetY, limits.maximumOffsetY),
  };
}

export function resetPlacement(): ArtworkPlacement {
  return { ...DEFAULT_PLACEMENT };
}

export type PlacementDirection = "left" | "right" | "up" | "down";

export function getSemanticSizeLabel(scale: number) {
  const tolerance = 0.035;
  if (scale < PLACEMENT_SCALE_LIMITS.recommended - tolerance) return "Smaller";
  if (scale > PLACEMENT_SCALE_LIMITS.recommended + tolerance) return "Larger";
  return "Recommended";
}

export function movePlacement(
  placement: ArtworkPlacement,
  direction: PlacementDirection,
  limits: PlacementLimits,
): ArtworkPlacement {
  const horizontalStep = Math.max(
    0.01,
    (limits.maximumOffsetX - limits.minimumOffsetX) *
      PLACEMENT_SCALE_LIMITS.movementStepRatio,
  );
  const verticalStep = Math.max(
    0.01,
    (limits.maximumOffsetY - limits.minimumOffsetY) *
      PLACEMENT_SCALE_LIMITS.movementStepRatio,
  );
  const next = { ...placement };
  if (direction === "left") next.offsetX -= horizontalStep;
  if (direction === "right") next.offsetX += horizontalStep;
  if (direction === "up") next.offsetY -= verticalStep;
  if (direction === "down") next.offsetY += verticalStep;
  return clampPlacement(next, limits);
}

export function centrePlacement(placement: ArtworkPlacement): ArtworkPlacement {
  return { ...placement, offsetX: 0, offsetY: 0 };
}
