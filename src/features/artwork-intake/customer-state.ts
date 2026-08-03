export type InternalArtworkPhase =
  | "idle"
  | "analysing"
  | "selecting"
  | "cropping"
  | "preparing"
  | "ready"
  | "needs-review"
  | "reviewing-extraction"
  | "failed";

export type CustomerArtworkState =
  | { status: "empty" }
  | { status: "analysing" }
  | { status: "select-logo-area" }
  | { status: "preparing" }
  | { status: "review-extraction" }
  | { status: "preview-ready" }
  | {
      status: "error-recoverable";
      recoveryAction: "select-area" | "replace-image";
    };

export function mapCustomerArtworkState(input: {
  hasUpload: boolean;
  processingState: InternalArtworkPhase;
  cropOpen: boolean;
  hasPreparedCandidate: boolean;
}): CustomerArtworkState {
  if (!input.hasUpload) return { status: "empty" };
  if (input.processingState === "idle") return { status: "analysing" };
  if (input.processingState === "analysing") return { status: "analysing" };
  if (input.processingState === "selecting" || input.cropOpen) {
    return { status: "select-logo-area" };
  }
  if (
    input.processingState === "cropping" ||
    input.processingState === "preparing"
  ) {
    return { status: "preparing" };
  }
  if (input.processingState === "reviewing-extraction") {
    return { status: "review-extraction" };
  }
  if (input.processingState === "failed") {
    return {
      status: "error-recoverable",
      recoveryAction: "select-area",
    };
  }
  if (
    input.processingState === "needs-review" &&
    !input.hasPreparedCandidate
  ) {
    return { status: "select-logo-area" };
  }
  if (input.processingState === "ready" || input.hasPreparedCandidate) {
    return { status: "preview-ready" };
  }
  return {
    status: "error-recoverable",
    recoveryAction: "replace-image",
  };
}
