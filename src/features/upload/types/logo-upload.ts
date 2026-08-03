import type { DecoderPath } from "@/features/upload/utils/decode-mobile-image";

export type UploadStatus =
  | "idle"
  | "drag-active"
  | "reading"
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
  originalFile?: File;
  normalisedBlob?: Blob;
  decoder?: DecoderPath | "svg";
  orientation?: "browser-decoded";
  resizedForWorkingCopy?: boolean;
};

export type ValidationResult =
  | { valid: true; extension: string }
  | { valid: false; message: string };

export type UploadSource = "gallery" | "camera" | "drop";
export type UploadTraceEntry = {
  id: number;
  stage: string;
  detail?: string;
  status: "ok" | "info" | "error";
};
