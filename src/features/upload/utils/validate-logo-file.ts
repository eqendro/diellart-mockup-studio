import {
  ACCEPTED_LOGO_EXTENSIONS,
  ACCEPTED_LOGO_MIME_TYPES,
  MAX_LOGO_FILE_SIZE_BYTES,
  MAX_LOGO_FILE_SIZE_LABEL,
} from "@/shared/constants/upload";
import type { ValidationResult } from "@/features/upload/types/logo-upload";

const supportedFormats = "PNG, JPG, JPEG, WebP or SVG";

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
  const hasSupportedExtension = ACCEPTED_LOGO_EXTENSIONS.includes(
    extension as (typeof ACCEPTED_LOGO_EXTENSIONS)[number],
  );

  if (!hasSupportedMimeType || !hasSupportedExtension) {
    return {
      valid: false,
      message: `This file type is not supported. Upload a ${supportedFormats} file.`,
    };
  }

  return { valid: true, extension };
}

