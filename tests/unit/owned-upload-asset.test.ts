import { describe, expect, it, vi } from "vitest";
import {
  captureSelectedFile,
  isAndroidProviderFileUnreadable,
  isPrimaryNotReadableError,
  OwnedUploadReadError,
  readExifOrientation,
} from "../../src/features/upload/utils/owned-upload-asset";

describe("owned upload asset", () => {
  it("identifies a primary provider NotReadableError without treating other read failures as provider failures", () => {
    const generatedFile = new File(["provider metadata"], "1000050619.png", {
      type: "image/png",
      lastModified: Date.now(),
    });
    const providerFailure = new OwnedUploadReadError(
      new DOMException("temporary provider handle", "NotReadableError"),
      new DOMException("fallback failed", "NotReadableError"),
    );
    expect(isPrimaryNotReadableError(providerFailure)).toBe(true);
    expect(isAndroidProviderFileUnreadable(generatedFile, "gallery", providerFailure)).toBe(true);
    expect(isAndroidProviderFileUnreadable(generatedFile, "camera", providerFailure)).toBe(false);
    expect(isPrimaryNotReadableError(new OwnedUploadReadError(
      new DOMException("generic failure", "InvalidStateError"),
      new Error("fallback failed"),
    ))).toBe(false);
  });
  it.each(["gallery", "file-manager"] as const)("copies %s picker bytes exactly once into the same contract", async (source) => {
    const provider = new File(["provider bytes"], "logo.jpg", { type: "image/jpeg" });
    const read = vi.spyOn(provider, "arrayBuffer");
    const captured = await captureSelectedFile(provider, source);
    expect(read).toHaveBeenCalledTimes(1);
    expect(captured.source).toBe(source);
    expect(captured.ownedBlob).not.toBe(provider);
    expect(await captured.ownedBlob.text()).toBe("provider bytes");
    expect(captured.ownedFile).not.toBe(provider);
  });

  it("creates a fresh session for same-file reselection", async () => {
    const file = new File(["same"], "same.png", { type: "image/png" });
    const first = await captureSelectedFile(file, "gallery");
    const second = await captureSelectedFile(file, "gallery");
    expect(first.sessionId).not.toBe(second.sessionId);
  });

  it("uses FileReader once and only after the primary read fails", async () => {
    const file = new File(["fallback"], "fallback.jpg", { type: "image/jpeg" });
    vi.spyOn(file, "arrayBuffer").mockRejectedValueOnce(new DOMException("provider failure", "NotReadableError"));
    const calls: string[] = [];
    const previous = globalThis.FileReader;
    class FakeFileReader {
      result: ArrayBuffer | null = null;
      error: DOMException | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      readAsArrayBuffer(value: File) {
        calls.push("fallback");
        void Blob.prototype.arrayBuffer.call(value).then((bytes) => {
          this.result = bytes;
          this.onload?.();
        });
      }
    }
    Object.defineProperty(globalThis, "FileReader", { value: FakeFileReader, configurable: true });
    try {
      const captured = await captureSelectedFile(file, "gallery", (stage) => calls.push(stage));
      expect(captured.readPath).toBe("file-reader");
      expect(calls.indexOf("primary copy failed")).toBeLessThan(calls.indexOf("fallback copy started"));
      expect(calls.filter((value) => value === "fallback")).toHaveLength(1);
    } finally {
      Object.defineProperty(globalThis, "FileReader", { value: previous, configurable: true });
    }
  });

  it.each([1, 3, 6, 8] as const)("reads EXIF orientation %s", (orientation) => {
    const bytes = new Uint8Array(36);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, 0xffd8, false); view.setUint16(2, 0xffe1, false); view.setUint16(4, 32, false);
    bytes.set([0x45,0x78,0x69,0x66,0,0,0x49,0x49], 6);
    view.setUint16(14, 42, true); view.setUint32(16, 8, true); view.setUint16(20, 1, true);
    view.setUint16(22, 0x0112, true); view.setUint16(24, 3, true); view.setUint32(26, 1, true); view.setUint16(30, orientation, true);
    expect(readExifOrientation(bytes.buffer)).toBe(orientation);
  });
});
