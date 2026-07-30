export type ArtworkPreparationStatus = "idle" | "processing" | "ready" | "error";

export type ArtworkAsset = {
  originalUrl: string;
  preparedUrl: string;
  printableUrl: string;
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  preparedWidth: number;
  preparedHeight: number;
  veryLight: boolean;
  foregroundBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  preparation: {
    backgroundClassification:
      | "transparent"
      | "removable-light-background"
      | "non-removable-background"
      | "processing-failed";
    backgroundRemoved: boolean;
    marginsCropped: boolean;
    status: ArtworkPreparationStatus;
    message?: string;
  };
};

export type PrintableArtwork = {
  url: string;
  filename: string;
  width: number;
  height: number;
  aspectRatio: number;
  veryLight: boolean;
  canvasWidth: number;
  canvasHeight: number;
  foregroundBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};
