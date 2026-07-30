import { ARTWORK_INTAKE_CONFIG } from "@/features/artwork-intake/config";
import { analyseArtworkPixels } from "@/features/artwork-intake/analyse-artwork-pixels";
import type { ArtworkIntakeResult } from "@/features/artwork-intake/types";
import type { AcceptedLogo } from "@/features/upload/types/logo-upload";

export async function analyseArtwork(
  logo: AcceptedLogo,
): Promise<ArtworkIntakeResult> {
  if (logo.mimeType === "image/svg+xml") {
    return {
      classification: "TransparentLogo",
      confidence: "Medium",
      recommendedWorkflow: "NoPreparation",
      reason: "Scalable logo artwork was detected.",
      warnings: [],
      requiresCrop: false,
      metrics: {
        transparentRatio: 0,
        borderUniformity: 0,
        borderLightness: 0,
        colourBucketRatio: 0,
        luminanceVariance: 0,
        edgeComplexity: 0,
        aspectRatio: logo.aspectRatio ?? 1,
      },
    };
  }
  const bitmap = await createImageBitmap(logo.file);
  try {
    const scale = Math.min(
      1,
      ARTWORK_INTAKE_CONFIG.analysisMaxDimension /
        Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Artwork analysis is unavailable.");
    context.drawImage(bitmap, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    return analyseArtworkPixels(pixels);
  } finally {
    bitmap.close();
  }
}
