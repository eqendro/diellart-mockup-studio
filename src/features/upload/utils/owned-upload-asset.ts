import type { UploadSource } from "@/features/upload/types/logo-upload";

export type CapturedUpload = {
  sessionId: string;
  source: UploadSource;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  ownedBytes: ArrayBuffer;
  ownedBlob: Blob;
  ownedFile: File;
  readPath: "array-buffer" | "file-reader";
  orientation?: 1 | 3 | 6 | 8;
};

export type UploadAcquisitionDiagnostics = {
  eventStartedAt: number;
  originalFile: File;
};

export class OwnedUploadReadError extends AggregateError {
  readonly primaryError: unknown;
  readonly fallbackError: unknown;

  constructor(primaryError: unknown, fallbackError: unknown) {
    super([primaryError, fallbackError], "Both owned byte-copy paths failed.");
    this.name = "OwnedUploadReadError";
    this.primaryError = primaryError;
    this.fallbackError = fallbackError;
  }
}

export function isPrimaryNotReadableError(cause: unknown) {
  return cause instanceof OwnedUploadReadError &&
    cause.primaryError instanceof DOMException &&
    cause.primaryError.name === "NotReadableError";
}

export function isAndroidProviderFileUnreadable(
  file: File,
  source: UploadSource,
  cause: unknown,
) {
  return (source === "gallery" || source === "file-manager") &&
    file.size > 0 &&
    Boolean(file.type || file.name) &&
    isPrimaryNotReadableError(cause);
}

const elapsed = (startedAt: number) =>
  `+${(performance.now() - startedAt).toFixed(3)}ms`;

function fileIdentity(file: File, originalFile: File) {
  const prototype = Object.getPrototypeOf(file) as { constructor?: { name?: string } } | null;
  return JSON.stringify({
    sameObject: file === originalFile,
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    constructorName: file.constructor?.name ?? "(unknown)",
    instanceofFile: file instanceof File,
    instanceofBlob: file instanceof Blob,
    prototypeConstructor: prototype?.constructor?.name ?? "(null)",
    prototypeIsFilePrototype: prototype === File.prototype,
    extensible: Object.isExtensible(file),
  });
}

export function readExifOrientation(bytes: ArrayBuffer): 1 | 3 | 6 | 8 | undefined {
  const view = new DataView(bytes);
  if (view.byteLength < 14 || view.getUint16(0, false) !== 0xffd8) return undefined;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset, false);
    const length = view.getUint16(offset + 2, false);
    if (marker === 0xffe1 && offset + 2 + length <= view.byteLength) {
      const tiff = offset + 10;
      const little = view.getUint16(tiff, false) === 0x4949;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      const count = view.getUint16(ifd, little);
      for (let index = 0; index < count; index++) {
        const entry = ifd + 2 + index * 12;
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little);
          return value === 1 || value === 3 || value === 6 || value === 8 ? value : undefined;
        }
      }
      return undefined;
    }
    if (length < 2) break;
    offset += 2 + length;
  }
  return undefined;
}

const newSessionId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function readWithFileReader(
  file: File,
  diagnostics?: UploadAcquisitionDiagnostics,
  onStage?: (stage: string, detail?: string, status?: "ok" | "info" | "error") => void,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timedStage = (stage: string, detail?: string, status?: "ok" | "info" | "error") => {
      if (diagnostics) onStage?.(stage, `${elapsed(diagnostics.eventStartedAt)}${detail ? `; ${detail}` : ""}`, status);
    };
    timedStage("FileReader created");
    reader.onloadstart = () => timedStage("FileReader loadstart");
    reader.onprogress = (event) => timedStage("FileReader progress", `${event.loaded}/${event.total}`);
    reader.onerror = () => {
      timedStage("FileReader error", reader.error ? `${reader.error.name}: ${reader.error.message}` : "no reader.error", "error");
      reject(reader.error ?? new Error("FileReader failed."));
    };
    reader.onabort = () => {
      timedStage("FileReader abort", undefined, "error");
      reject(new Error("FileReader was aborted."));
    };
    reader.onload = () => {
      timedStage("FileReader load", reader.result instanceof ArrayBuffer ? `${reader.result.byteLength} bytes` : "non-ArrayBuffer result");
      return reader.result instanceof ArrayBuffer
        ? resolve(reader.result)
        : reject(new Error("FileReader returned no ArrayBuffer."));
    };
    reader.onloadend = () => timedStage("FileReader loadend", `readyState=${reader.readyState}`);
    timedStage("FileReader.readAsArrayBuffer invoked");
    reader.readAsArrayBuffer(file);
  });
}

function verifyByteLength(bytes: ArrayBuffer, expected: number) {
  if (bytes.byteLength === 0 || bytes.byteLength !== expected) {
    throw new Error(`OWNED_BYTE_LENGTH_MISMATCH: expected ${expected}, received ${bytes.byteLength}.`);
  }
  return bytes;
}

/** This is the sole permitted read of a picker/provider-backed File. */
export async function captureSelectedFile(
  providerFile: File,
  source: UploadSource,
  onStage?: (stage: string, detail?: string, status?: "ok" | "info" | "error") => void,
  diagnostics?: UploadAcquisitionDiagnostics,
): Promise<CapturedUpload> {
  if (diagnostics) {
    onStage?.("owned-asset function entered", elapsed(diagnostics.eventStartedAt));
    onStage?.("File identity before byte read", `${elapsed(diagnostics.eventStartedAt)}; ${fileIdentity(providerFile, diagnostics.originalFile)}`);
  }
  const sessionId = newSessionId();
  onStage?.("session created", diagnostics ? `${elapsed(diagnostics.eventStartedAt)}; ${sessionId}` : sessionId);
  onStage?.("picker source", source);
  onStage?.("original File captured", providerFile.name || "(no name)");
  onStage?.("primary byte copy started", `${providerFile.size} bytes`);
  let ownedBytes: ArrayBuffer;
  let readPath: CapturedUpload["readPath"] = "array-buffer";
  try {
    const invokedAt = diagnostics ? performance.now() : 0;
    let readPromise: Promise<ArrayBuffer>;
    try {
      if (diagnostics) onStage?.("File.arrayBuffer invoked", elapsed(diagnostics.eventStartedAt));
      readPromise = providerFile.arrayBuffer();
    } catch (cause) {
      if (diagnostics) onStage?.("File.arrayBuffer synchronous throw", `${elapsed(diagnostics.eventStartedAt)}; ${cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)}`, "error");
      throw cause;
    }
    try {
      ownedBytes = verifyByteLength(await readPromise, providerFile.size);
      if (diagnostics) onStage?.("File.arrayBuffer resolved", `${elapsed(diagnostics.eventStartedAt)}; read ${(performance.now() - invokedAt).toFixed(3)}ms; ${ownedBytes.byteLength} bytes`);
    } catch (cause) {
      if (diagnostics) onStage?.("File.arrayBuffer rejected", `${elapsed(diagnostics.eventStartedAt)}; read ${(performance.now() - invokedAt).toFixed(3)}ms; ${cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)}`, "error");
      throw cause;
    }
    onStage?.("primary copy succeeded", `${ownedBytes.byteLength} bytes`);
  } catch (primaryError) {
    onStage?.("primary copy failed", primaryError instanceof Error ? primaryError.message : String(primaryError), "error");
    onStage?.("fallback copy started", `${providerFile.size} bytes`, "info");
    readPath = "file-reader";
    try {
      ownedBytes = verifyByteLength(await readWithFileReader(providerFile, diagnostics, onStage), providerFile.size);
      onStage?.("fallback copy succeeded", `${ownedBytes.byteLength} bytes`);
    } catch (fallbackError) {
      onStage?.("fallback copy failed", fallbackError instanceof Error ? fallbackError.message : String(fallbackError), "error");
      throw new OwnedUploadReadError(primaryError, fallbackError);
    }
  }
  onStage?.("copied byte length", `${ownedBytes.byteLength} bytes`);
  const ownedBlob = new Blob([ownedBytes], { type: providerFile.type || "application/octet-stream" });
  onStage?.("owned asset created", `${readPath}; ${ownedBlob.size} bytes`);
  const ownedFile = new File([ownedBlob], providerFile.name || "image", {
    type: providerFile.type,
    lastModified: providerFile.lastModified,
  });
  const orientation = readExifOrientation(ownedBytes);
  onStage?.("orientation", String(orientation ?? 1));
  return {
    sessionId,
    source,
    filename: providerFile.name,
    mimeType: providerFile.type,
    sizeBytes: providerFile.size,
    ownedBytes,
    ownedBlob,
    ownedFile,
    readPath,
    orientation,
  };
}
