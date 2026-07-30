import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPreparationFallback,
  createProcessingAsset,
  revokeOwnedObjectUrl,
  selectPrintableArtwork,
} from "../../src/features/logo-engine/preparation/artwork-state";
import type { AcceptedLogo } from "../../src/features/upload/types/logo-upload";

const logo = {
  file: new File(["logo"], "brand.png", { type: "image/png" }),
  filename: "brand.png",
  mimeType: "image/png",
  extension: "png",
  sizeBytes: 4,
  formattedSize: "4 B",
  width: 400,
  height: 200,
  aspectRatio: 2,
  previewUrl: "blob:original",
} satisfies AcceptedLogo;

afterEach(() => vi.restoreAllMocks());

describe("artwork lifecycle", () => {
  it("preserves the original after preparation data is added", () => {
    const original = createProcessingAsset(logo);
    const prepared = {
      ...original,
      preparedUrl: "blob:prepared",
      printableUrl: "blob:prepared",
      preparation: { ...original.preparation, status: "ready" as const },
    };
    expect(prepared.originalUrl).toBe("blob:original");
    expect(selectPrintableArtwork(prepared, true).url).toBe("blob:original");
  });

  it("selects prepared artwork by default for the renderer", () => {
    const asset = {
      ...createProcessingAsset(logo),
      preparedUrl: "blob:prepared",
      printableUrl: "blob:prepared",
      preparedWidth: 300,
      preparedHeight: 100,
      foregroundBounds: { x: 10, y: 5, width: 270, height: 90 },
      preparation: { ...createProcessingAsset(logo).preparation, status: "ready" as const },
    };
    expect(selectPrintableArtwork(asset, false)).toMatchObject({
      url: "blob:prepared",
      aspectRatio: 3,
    });
  });

  it("falls back to the original when preparation fails", () => {
    const fallback = createPreparationFallback(createProcessingAsset(logo));
    expect(fallback.preparation.status).toBe("error");
    expect(selectPrintableArtwork(fallback, false).url).toBe("blob:original");
  });

  it("revokes and clears owned generated URLs", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const reference = { current: "blob:prepared" as string | null };
    revokeOwnedObjectUrl(reference);
    expect(revoke).toHaveBeenCalledWith("blob:prepared");
    expect(reference.current).toBeNull();
  });
});
