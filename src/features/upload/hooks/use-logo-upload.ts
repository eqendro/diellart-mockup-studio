"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AcceptedLogo,
  UploadStatus,
} from "@/features/upload/types/logo-upload";
import { formatFileSize, readImageDimensions } from "@/features/upload/utils/file-metadata";
import { validateLogoFile } from "@/features/upload/utils/validate-logo-file";

const multipleFilesError = "Select only one logo at a time.";
const invalidImageError =
  "The image could not be read. Try exporting the logo again.";

export function useLogoUpload() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [logo, setLogo] = useState<AcceptedLogo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeUrlRef = useRef<string | null>(null);

  const revokeActiveUrl = useCallback(() => {
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }
  }, []);

  useEffect(() => revokeActiveUrl, [revokeActiveUrl]);

  const setUploadError = useCallback((message: string) => {
    setError(message);
    setStatus("error");
  }, []);

  const selectFiles = useCallback(
    async (files: File[]) => {
      if (files.length !== 1) {
        setUploadError(multipleFilesError);
        return;
      }

      const file = files[0];
      const validation = validateLogoFile(file);

      if (!validation.valid) {
        setUploadError(validation.message);
        return;
      }

      setStatus("validating");
      setError(null);
      const nextUrl = URL.createObjectURL(file);

      try {
        const dimensions = await readImageDimensions(
          nextUrl,
          validation.extension === "svg",
        );

        revokeActiveUrl();
        activeUrlRef.current = nextUrl;
        setLogo({
          file,
          filename: file.name,
          mimeType: file.type,
          extension: validation.extension,
          sizeBytes: file.size,
          formattedSize: formatFileSize(file.size),
          previewUrl: nextUrl,
          ...dimensions,
        });
        setStatus("accepted");
      } catch {
        URL.revokeObjectURL(nextUrl);
        setUploadError(invalidImageError);
      }
    },
    [revokeActiveUrl, setUploadError],
  );

  const removeLogo = useCallback(() => {
    revokeActiveUrl();
    setLogo(null);
    setError(null);
    setStatus("idle");
  }, [revokeActiveUrl]);

  const dismissError = useCallback(() => {
    setError(null);
    setStatus(logo ? "accepted" : "idle");
  }, [logo]);

  const setDragActive = useCallback((isActive: boolean) => {
    setStatus((current) => {
      if (current === "validating" || current === "accepted") {
        return current;
      }
      return isActive ? "drag-active" : "idle";
    });
  }, []);

  return {
    status,
    logo,
    error,
    selectFiles,
    rejectFiles: setUploadError,
    removeLogo,
    setDragActive,
    dismissError,
  };
}
