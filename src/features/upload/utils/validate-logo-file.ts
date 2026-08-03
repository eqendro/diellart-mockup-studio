import {
  ACCEPTED_LOGO_EXTENSIONS,
  ACCEPTED_LOGO_MIME_TYPES,
  MAX_LOGO_FILE_SIZE_BYTES,
  MAX_LOGO_FILE_SIZE_LABEL,
} from "@/shared/constants/upload";
import type { ValidationResult } from "@/features/upload/types/logo-upload";

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot > -1 ? filename.slice(lastDot + 1).toLowerCase() : "";
}

export function validateLogoFile(file: File): ValidationResult {
  if (file.size === 0) {
    return {
      valid: false,
      message: "This file is empty. Choose a logo file that contains image data.",
    };
  }

  if (file.size > MAX_LOGO_FILE_SIZE_BYTES) {
    return {
      valid: false,
      message: `The selected file is larger than the ${MAX_LOGO_FILE_SIZE_LABEL} limit.`,
    };
  }

  const extension = getFileExtension(file.name);
  const hasSupportedMimeType = ACCEPTED_LOGO_MIME_TYPES.includes(
    file.type as (typeof ACCEPTED_LOGO_MIME_TYPES)[number],
  );
  const hasAndroidImageMime = file.type === "image/jpg" || file.type === "image/*";
  const hasSupportedExtension = ACCEPTED_LOGO_EXTENSIONS.includes(
    extension as (typeof ACCEPTED_LOGO_EXTENSIONS)[number],
  );

  // Android camera/gallery providers may omit the extension or MIME type.
  // Accept when either trustworthy browser signal identifies a supported image.
  if (!hasSupportedMimeType && !hasAndroidImageMime && !hasSupportedExtension) {
    // Android content providers may return a useful non-empty image with both
    // metadata fields missing. The canonical decoder is the final authority.
    return { valid: true, extension: extension || "image" };
  }

  const resolvedExtension = hasSupportedExtension
    ? extension
    : file.type === "image/jpeg" || file.type === "image/jpg" ? "jpg" : file.type.split("/")[1] ?? extension;
  return { valid: true, extension: resolvedExtension };
}
