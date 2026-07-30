import type { PrintableArtwork } from "@/features/logo-engine/types/artwork";
import type { ArtworkPlacement } from "@/features/mockup-engine/placement";
import type { LogoFit } from "@/features/mockup-engine/utils/calculate-logo-fit";

export type ResolvedArtworkGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  aspectRatio: number;
};

export function resolveArtworkGeometry(
  fit: LogoFit,
  artwork: PrintableArtwork,
  placement: ArtworkPlacement,
): ResolvedArtworkGeometry {
  const sourceScale =
    artwork.foregroundBounds.width > 0
      ? fit.width / artwork.foregroundBounds.width
      : 0;
  const width = artwork.canvasWidth * sourceScale;
  const height = artwork.canvasHeight * sourceScale;
  return {
    left: fit.x - artwork.foregroundBounds.x * sourceScale,
    top: fit.y - artwork.foregroundBounds.y * sourceScale,
    width,
    height,
    scale: placement.scale,
    offsetX: placement.offsetX,
    offsetY: placement.offsetY,
    aspectRatio:
      artwork.canvasHeight > 0 ? artwork.canvasWidth / artwork.canvasHeight : 0,
  };
}
