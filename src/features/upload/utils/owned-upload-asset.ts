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
  orientation?: 1 | 3 | 6 | 8;
};

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

/** This is the sole permitted read of a picker/provider-backed File. */
export async function captureSelectedFile(
  providerFile: File,
  source: UploadSource,
  onStage?: (stage: string, detail?: string, status?: "ok" | "info" | "error") => void,
): Promise<CapturedUpload> {
  const sessionId = newSessionId();
  onStage?.("session ID", sessionId);
  onStage?.("picker source", source);
  onStage?.("original File captured", providerFile.name || "(no name)");
  onStage?.("byte copy started", `${providerFile.size} bytes`);
  const ownedBytes = await providerFile.arrayBuffer();
  onStage?.("byte copy completed", `${ownedBytes.byteLength} bytes`);
  const ownedBlob = new Blob([ownedBytes], { type: providerFile.type || "application/octet-stream" });
  onStage?.("owned Blob created", `${ownedBlob.size} bytes`);
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
    orientation,
  };
}
