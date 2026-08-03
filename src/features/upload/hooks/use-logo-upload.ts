"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AcceptedLogo,
  UploadSource,
  UploadStatus,
  UploadTraceEntry,
} from "@/features/upload/types/logo-upload";
import { formatFileSize, readImageDimensions } from "@/features/upload/utils/file-metadata";
import { decodeMobileImage } from "@/features/upload/utils/decode-mobile-image";
import { validateLogoFile } from "@/features/upload/utils/validate-logo-file";

const multipleFilesError = "Select only one logo at a time.";
const invalidImageError =
  "We received the image but could not open it on this device. Please try another photo.";

export function useLogoUpload() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [logo, setLogo] = useState<AcceptedLogo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeUrlRef = useRef<string | null>(null);
  const traceIdRef = useRef(0);
  const [trace, setTrace] = useState<UploadTraceEntry[]>([]);

  const recordTrace = useCallback((stage: string, detail?: string, status: UploadTraceEntry["status"] = "ok") => {
    if (process.env.NODE_ENV === "production") return;
    const entry = { id: ++traceIdRef.current, stage, detail, status };
    setTrace((current) => [...current.slice(-30), entry]);
    console.debug("[upload-event-trace]", entry);
  }, []);

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

  const processSelectedArtworkFile = useCallback(
    async (file: File, source: UploadSource = "gallery") => {
      recordTrace("processing function entered", source);
      setStatus("reading");
      setError(null);
      recordTrace("reading state set", file.name || "(no name)");
      recordTrace("first File obtained", source);
      recordTrace("file metadata", `${file.name || "(no name)"}; ${file.type || "(no MIME)"}; ${file.size} bytes; ${file.lastModified}`);
      // Give React a paint opportunity so the customer sees confirmation
      // before validation or decoding begins.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      recordTrace("validation started");
      const validation = validateLogoFile(file);

      if (!validation.valid) {
        recordTrace("validation failed", validation.message, "error");
        setUploadError(validation.message);
        return;
      }

      recordTrace("validation passed", validation.extension);
      setStatus("validating");
      let nextUrl: string | null = null;

      try {
        const isSvg = validation.extension === "svg";
        recordTrace("decode started", isSvg ? "SVG browser decode" : "raster mobile decoder");
        const normalised = isSvg ? null : await decodeMobileImage(file, {
          onStage: (stage, detail) => recordTrace(stage, detail),
        });
        nextUrl = normalised?.objectUrl ?? URL.createObjectURL(file);
        const dimensions = normalised
          ? { width: normalised.width, height: normalised.height, aspectRatio: normalised.width / normalised.height }
          : await readImageDimensions(nextUrl, true);

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
          originalFile: file,
          normalisedBlob: normalised?.blob ?? file,
          decoder: normalised?.decoder ?? "svg",
          orientation: normalised?.orientation,
          resizedForWorkingCopy: normalised?.resized ?? false,
          ...dimensions,
        });
        setStatus("accepted");
        recordTrace("upload state updated", "accepted");
      } catch (cause) {
        if (nextUrl) URL.revokeObjectURL(nextUrl);
        if (process.env.NODE_ENV !== "production") {
          console.error("[mobile-image-decode]", file.name, cause);
        }
        recordTrace("decode failed", cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause), "error");
        setUploadError(invalidImageError);
      }
    },
    [recordTrace, revokeActiveUrl, setUploadError],
  );

  const selectFiles = useCallback(
    async (files: File[], source: UploadSource = "gallery") => {
      if (files.length !== 1) {
        recordTrace("processing skipped", files.length === 0 ? "NO_FILE_RETURNED" : "MULTIPLE_FILES", files.length === 0 ? "info" : "error");
        if (files.length > 1) setUploadError(multipleFilesError);
        return;
      }
      await processSelectedArtworkFile(files[0], source);
    },
    [processSelectedArtworkFile, recordTrace, setUploadError],
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
      if (current === "reading" || current === "validating" || current === "accepted") {
        return current;
      }
      return isActive ? "drag-active" : "idle";
    });
  }, []);

  return {
    status,
    logo,
    error,
    trace,
    recordTrace,
    selectFiles,
    processSelectedArtworkFile,
    rejectFiles: setUploadError,
    removeLogo,
    setDragActive,
    dismissError,
  };
}
