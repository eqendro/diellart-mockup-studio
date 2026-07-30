import type { PreparationDiagnostics } from "@/features/logo-engine/preparation/process-pixels";

export function reportPreparationDiagnostics(
  filename: string,
  diagnostics: PreparationDiagnostics,
) {
  if (process.env.NODE_ENV === "production") return;
  console.debug("[artwork-preparation]", filename, {
    originalSize: `${diagnostics.originalWidth}×${diagnostics.originalHeight}`,
    preparedSize: `${diagnostics.preparedWidth}×${diagnostics.preparedHeight}`,
    foregroundWidth: diagnostics.foregroundBounds?.width ?? 0,
    foregroundHeight: diagnostics.foregroundBounds?.height ?? 0,
    foregroundPercent: diagnostics.foregroundPercent,
    transparentPercent: diagnostics.transparentPercent,
    boundingBox: diagnostics.foregroundBounds,
    paddingApplied: diagnostics.paddingApplied,
    validationPassed: diagnostics.validationPassed,
    cleanupPassUsed: diagnostics.cleanupPassUsed,
  });
}
