export { analyseArtwork } from "@/features/artwork-intake/analyse-artwork";
export { analyseArtworkPixels } from "@/features/artwork-intake/analyse-artwork-pixels";
export { createExtractedLogo, extractLogoPixels, validateExtractedLogo } from "@/features/artwork-intake/extract-logo";
export type { ExtractionMode, Rgb } from "@/features/artwork-intake/extract-logo";
export {
  createCroppedArtwork,
  mapCropToOriginal,
  mapDisplayCropToNatural,
} from "@/features/artwork-intake/crop-artwork";
export {
  createCandidateOutcome,
  isUsableArtworkCandidate,
  selectIntakeRoute,
} from "@/features/artwork-intake/workflow";
export type { IntakeRoute } from "@/features/artwork-intake/workflow";
export {
  mapCustomerArtworkState,
} from "@/features/artwork-intake/customer-state";
export type {
  CustomerArtworkState,
} from "@/features/artwork-intake/customer-state";
export type {
  ArtworkClassification,
  ArtworkIntakeMetrics,
  ArtworkIntakeResult,
  IntakeConfidence,
  RecommendedWorkflow,
} from "@/features/artwork-intake/types";
export type {
  NormalisedCrop,
  CropSelection,
  CroppedArtwork,
  DisplayRect,
  PixelCropCoordinates,
  PreparationOutcome,
} from "@/features/artwork-intake/workflow-types";
