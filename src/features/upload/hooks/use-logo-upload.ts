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
import { captureSelectedFile } from "@/features/upload/utils/owned-upload-asset";

const multipleFilesError = "Select only one logo at a time.";
const invalidImageError =
  "We received the image but could not open it on this device. Please try another photo.";

export function useLogoUpload() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [logo, setLogo] = useState<AcceptedLogo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeUrlRef = useRef<{ sessionId: string; url: string; revoked: boolean } | null>(null);
  const traceIdRef = useRef(0);
  const generationRef = useRef(0);
  const [trace, setTrace] = useState<UploadTraceEntry[]>([]);

  const recordTrace = useCallback((stage: string, detail?: string, status: UploadTraceEntry["status"] = "ok") => {
    const entry = { id: ++traceIdRef.current, stage, detail, status };
    setTrace((current) => [...current.slice(-99), entry]);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugUpload") === "1") {
      console.debug("[upload-event-trace]", entry);
    }
  }, []);

  const revokeActiveUrl = useCallback(() => {
    if (activeUrlRef.current && !activeUrlRef.current.revoked) {
      URL.revokeObjectURL(activeUrlRef.current.url);
      recordTrace("object URL revoked", `${activeUrlRef.current.sessionId}; ${activeUrlRef.current.url}`);
      activeUrlRef.current.revoked = true;
      activeUrlRef.current = null;
    }
  }, [recordTrace]);

  useEffect(() => revokeActiveUrl, [revokeActiveUrl]);

  const setUploadError = useCallback((message: string) => {
    setError(message);
    setStatus("error");
  }, []);

  const processSelectedArtworkFile = useCallback(
    async (file: File, source: UploadSource = "gallery") => {
      const generation = ++generationRef.current;
      recordTrace("processing function entered", source);
      setStatus("reading");
      setError(null);
      recordTrace("reading state set", file.name || "(no name)");
      recordTrace("first File obtained", source);
      recordTrace("file metadata", `${file.name || "(no name)"}; ${file.type || "(no MIME)"}; ${file.size} bytes; ${file.lastModified}`);
      let captured;
      try {
        captured = await captureSelectedFile(file, source, recordTrace);
      } catch (cause) {
        recordTrace("byte copy failed", cause instanceof Error ? cause.message : String(cause), "error");
        setUploadError("We could not read that file. Please choose it again or try another image.");
        return;
      }
      // No code below this boundary may retain or read `file`.
      const ownedFile = captured.ownedFile;
      if (generation !== generationRef.current) return;
      recordTrace("validation started");
      const validation = validateLogoFile(ownedFile);

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
        const normalised = isSvg ? null : await decodeMobileImage(captured.ownedBlob, {
          onStage: (stage, detail) => recordTrace(stage, detail),
        });
        if (generation !== generationRef.current) {
          if (normalised?.objectUrl) URL.revokeObjectURL(normalised.objectUrl);
          recordTrace("processing skipped", `stale session ${captured.sessionId}`, "info");
          return;
        }
        nextUrl = normalised?.objectUrl ?? URL.createObjectURL(captured.ownedBlob);
        recordTrace("object URL created", `${captured.sessionId}; ${nextUrl}`);
        const dimensions = normalised
          ? { width: normalised.width, height: normalised.height, aspectRatio: normalised.width / normalised.height }
          : await readImageDimensions(nextUrl, true);

        revokeActiveUrl();
        activeUrlRef.current = { sessionId: captured.sessionId, url: nextUrl, revoked: false };
        setLogo({
          file: ownedFile,
          sessionId: captured.sessionId,
          source,
          ownedBytes: captured.ownedBytes,
          ownedBlob: captured.ownedBlob,
          filename: captured.filename,
          mimeType: captured.mimeType,
          extension: validation.extension,
          sizeBytes: captured.sizeBytes,
          formattedSize: formatFileSize(captured.sizeBytes),
          previewUrl: nextUrl,
          normalisedBlob: normalised?.blob ?? captured.ownedBlob,
          decoder: normalised?.decoder ?? "svg",
          orientation: captured.orientation ?? normalised?.orientation,
          resizedForWorkingCopy: normalised?.resized ?? false,
          ...dimensions,
        });
        setStatus("accepted");
        recordTrace("upload state updated", "accepted");
      } catch (cause) {
        if (nextUrl) URL.revokeObjectURL(nextUrl);
        if (generation !== generationRef.current) return;
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
    generationRef.current += 1;
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
