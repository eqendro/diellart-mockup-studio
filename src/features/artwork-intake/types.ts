export type ArtworkClassification =
  | "TransparentLogo"
  | "LogoOnPlainBackground"
  | "Photograph"
  | "Screenshot"
  | "Document"
  | "Unknown";

export type IntakeConfidence = "High" | "Medium" | "Low";

export type RecommendedWorkflow =
  | "NoPreparation"
  | "BackgroundRemoval"
  | "CropRequired"
  | "CropAndBackgroundRemoval"
  | "ManualReview";

export type ArtworkIntakeMetrics = {
  transparentRatio: number;
  borderUniformity: number;
  borderLightness: number;
  colourBucketRatio: number;
  luminanceVariance: number;
  edgeComplexity: number;
  aspectRatio: number;
};

export type ArtworkIntakeResult = {
  classification: ArtworkClassification;
  confidence: IntakeConfidence;
  recommendedWorkflow: RecommendedWorkflow;
  reason: string;
  warnings: string[];
  metrics: ArtworkIntakeMetrics;
  requiresCrop: boolean;
  preparationAfterCrop?: "BackgroundRemoval";
};
