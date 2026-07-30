import type { ArtworkIntakeResult } from "@/features/artwork-intake/types";
import type { PreparationOutcome } from "@/features/artwork-intake/workflow-types";
import type { ArtworkAsset } from "@/features/logo-engine/types/artwork";
import type { ArtworkClassification } from "@/features/artwork-intake/types";

export type IntakeRoute = "prepare-automatically" | "open-crop" | "manual-review";

export function selectIntakeRoute(result: ArtworkIntakeResult): IntakeRoute {
  if (result.requiresCrop) return "open-crop";
  if (result.recommendedWorkflow === "ManualReview") return "manual-review";
  return "prepare-automatically";
}

export function createCandidateOutcome(
  preparedArtwork: ArtworkAsset,
  confidence: "high" | "medium",
): PreparationOutcome {
  return confidence === "high"
    ? { status: "ready", confidence, preparedArtwork }
    : {
        status: "review-required",
        confidence,
        preparedCandidate: preparedArtwork,
        recommendedAction: "confirm",
      };
}

export function isUsableArtworkCandidate(
  candidate: ArtworkAsset | null,
  classification?: ArtworkClassification,
) {
  if (!candidate) return false;
  const bounds = candidate.foregroundBounds;
  const valid =
    candidate.printableUrl.length > 0 &&
    candidate.preparedWidth > 0 &&
    candidate.preparedHeight > 0 &&
    bounds.width > 0 &&
    bounds.height > 0;
  if (!valid) return false;
  if (classification === "TransparentLogo") return true;
  if (
    classification === "LogoOnPlainBackground" ||
    classification === "Photograph" ||
    classification === "Screenshot" ||
    classification === "Document" ||
    classification === "Unknown"
  ) {
    return candidate.printableUrl !== candidate.originalUrl;
  }
  return true;
}
