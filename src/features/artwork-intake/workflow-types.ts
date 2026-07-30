import type { ArtworkAsset } from "@/features/logo-engine/types/artwork";

export type PreparationOutcome =
  | {
      status: "ready";
      confidence: "high" | "medium";
      preparedArtwork: ArtworkAsset;
    }
  | {
      status: "review-required";
      confidence: "low" | "medium";
      preparedCandidate?: ArtworkAsset;
      recommendedAction: "confirm" | "crop" | "use-original";
    }
  | {
      status: "failed";
      recommendedAction: "crop" | "use-original";
    };

export type NormalisedCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PixelCropCoordinates = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DisplayRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropSelection = {
  normalised: NormalisedCrop;
  displayCrop: DisplayRect;
  displayedImage: DisplayRect;
  naturalWidth: number;
  naturalHeight: number;
};

export type CroppedArtwork = {
  logo: import("@/features/upload/types/logo-upload").AcceptedLogo;
  crop: PixelCropCoordinates;
  objectUrl: string;
};
