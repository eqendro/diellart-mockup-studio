export type UploadStatus =
  | "idle"
  | "drag-active"
  | "validating"
  | "accepted"
  | "error";

export type AcceptedLogo = {
  file: File;
  filename: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  formattedSize: string;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  previewUrl: string;
};

export type ValidationResult =
  | { valid: true; extension: string }
  | { valid: false; message: string };

