import { describe, expect, it } from "vitest";
import { mapCustomerArtworkState } from "../../src/features/artwork-intake";

describe("customer artwork state", () => {
  it("does not show an error while a newly accepted upload is waiting for analysis", () => {
    expect(
      mapCustomerArtworkState({
        hasUpload: true,
        processingState: "idle",
        cropOpen: false,
        hasPreparedCandidate: false,
      }),
    ).toEqual({ status: "analysing" });
  });
  it("maps automatic transparent/plain preparation to PreviewReady", () => {
    expect(
      mapCustomerArtworkState({
        hasUpload: true,
        processingState: "ready",
        cropOpen: false,
        hasPreparedCandidate: true,
      }),
    ).toEqual({ status: "preview-ready" });
  });

  it.each(["Photograph", "Screenshot", "Document"])(
    "maps uncertain %s workflows to SelectLogoArea",
    () => {
      expect(
        mapCustomerArtworkState({
          hasUpload: true,
          processingState: "selecting",
          cropOpen: false,
          hasPreparedCandidate: false,
        }),
      ).toEqual({ status: "select-logo-area" });
    },
  );

  it("maps crop processing to Preparing", () => {
    expect(
      mapCustomerArtworkState({
        hasUpload: true,
        processingState: "preparing",
        cropOpen: false,
        hasPreparedCandidate: true,
      }),
    ).toEqual({ status: "preparing" });
  });

  it("maps a successful medium-confidence candidate directly to PreviewReady", () => {
    expect(
      mapCustomerArtworkState({
        hasUpload: true,
        processingState: "needs-review",
        cropOpen: false,
        hasPreparedCandidate: true,
      }),
    ).toEqual({ status: "preview-ready" });
  });

  it("routes uncertain artwork without a candidate to SelectLogoArea", () => {
    expect(
      mapCustomerArtworkState({
        hasUpload: true,
        processingState: "needs-review",
        cropOpen: false,
        hasPreparedCandidate: false,
      }),
    ).toEqual({ status: "select-logo-area" });
  });

  it("never treats a failed unprepared photograph as preview-ready", () => {
    expect(
      mapCustomerArtworkState({
        hasUpload: true,
        processingState: "failed",
        cropOpen: false,
        hasPreparedCandidate: true,
      }),
    ).toEqual({
      status: "error-recoverable",
      recoveryAction: "select-area",
    });
  });
});
