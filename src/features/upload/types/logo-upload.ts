import type { DecoderPath } from "@/features/upload/utils/decode-mobile-image";

export type UploadStatus =
  | "idle"
  | "drag-active"
  | "reading"
  | "validating"
  | "accepted"
  | "error";

export type AcceptedLogo = {
  /** Application-owned file facade; never the picker/provider-backed File. */
  file: File;
  sessionId: string;
  source: UploadSource;
  ownedBytes: ArrayBuffer;
  ownedBlob: Blob;
  filename: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  formattedSize: string;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  previewUrl: string;
  normalisedBlob?: Blob;
  decoder?: DecoderPath | "svg";
  orientation?: 1 | 3 | 6 | 8 | "browser-decoded";
  resizedForWorkingCopy?: boolean;
};

export type ValidationResult =
  | { valid: true; extension: string }
  | { valid: false; message: string };

export type UploadSource = "gallery" | "file-manager" | "camera" | "drop";
export type UploadTraceEntry = {
  id: number;
  stage: string;
  detail?: string;
  status: "ok" | "info" | "error";
};
