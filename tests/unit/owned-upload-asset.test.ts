import { describe, expect, it, vi } from "vitest";
import { captureSelectedFile, readExifOrientation } from "../../src/features/upload/utils/owned-upload-asset";

describe("owned upload asset", () => {
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
