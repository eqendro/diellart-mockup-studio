import type { ArtworkAsset, PrintableArtwork } from "@/features/logo-engine/types/artwork";
import type { AcceptedLogo } from "@/features/upload/types/logo-upload";

export function createProcessingAsset(logo: AcceptedLogo): ArtworkAsset {
  return {
    originalUrl: logo.previewUrl,
    preparedUrl: logo.previewUrl,
    printableUrl: logo.previewUrl,
    filename: logo.filename,
    mimeType: logo.mimeType,
    width: logo.width ?? 1,
    height: logo.height ?? 1,
    preparedWidth: logo.width ?? 1,
    preparedHeight: logo.height ?? 1,
    veryLight: false,
    foregroundBounds: {
      x: 0,
      y: 0,
      width: logo.width ?? 1,
      height: logo.height ?? 1,
    },
    preparation: {
      backgroundClassification: "non-removable-background",
      backgroundRemoved: false,
      marginsCropped: false,
      status: "processing",
    },
  };
}

export function createPreparationFallback(asset: ArtworkAsset): ArtworkAsset {
  return {
    ...asset,
    preparedUrl: asset.originalUrl,
    printableUrl: asset.originalUrl,
    preparation: {
      ...asset.preparation,
      status: "error",
      backgroundClassification: "processing-failed",
      message: "We could not prepare this file automatically. Your original artwork is shown instead.",
    },
  };
}

export function selectPrintableArtwork(
  asset: ArtworkAsset,
  showOriginal: boolean,
): PrintableArtwork {
  const original = showOriginal || asset.preparation.status === "error";
  const width = original ? asset.width : asset.preparedWidth;
  const height = original ? asset.height : asset.preparedHeight;
  const foregroundBounds = original
    ? { x: 0, y: 0, width, height }
    : asset.foregroundBounds;
  return {
    url: original ? asset.originalUrl : asset.printableUrl,
    filename: asset.filename,
    width,
    height,
    aspectRatio: foregroundBounds.width / foregroundBounds.height,
    veryLight: asset.veryLight,
    canvasWidth: width,
    canvasHeight: height,
    foregroundBounds,
  };
}

export function revokeOwnedObjectUrl(reference: { current: string | null }) {
  if (!reference.current) return;
  URL.revokeObjectURL(reference.current);
  reference.current = null;
}
