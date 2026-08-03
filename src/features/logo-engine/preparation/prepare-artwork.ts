import { ARTWORK_PREPARATION_CONFIG } from "@/features/logo-engine/preparation/config";
import { prepareArtworkPixels } from "@/features/logo-engine/preparation/process-pixels";
import type {
  ForegroundBounds,
  PreparationDiagnostics,
} from "@/features/logo-engine/preparation/process-pixels";
import type { AcceptedLogo } from "@/features/upload/types/logo-upload";
import { reportPreparationDiagnostics } from "@/features/logo-engine/preparation/diagnostics";
import { decodeBlobToCanvas } from "@/features/upload/utils/decode-mobile-image";

export type PreparedArtworkResult = {
  blob: Blob;
  width: number;
  height: number;
  backgroundRemoved: boolean;
  marginsCropped: boolean;
  backgroundClassification: "transparent" | "removable-light-background" | "non-removable-background";
  veryLight: boolean;
  foregroundBounds: ForegroundBounds;
  diagnostics: PreparationDiagnostics;
};

export async function prepareArtwork(logo: AcceptedLogo): Promise<PreparedArtworkResult | null> {
  if (logo.mimeType === "image/svg+xml") return null;
  if (!logo.normalisedBlob) throw new Error("NORMALISED_IMAGE_REQUIRED: preparation cannot decode the original upload.");
  const image = await decodeBlobToCanvas(logo.normalisedBlob);
    const scale = Math.min(
      1,
      ARTWORK_PREPARATION_CONFIG.analysisMaxDimension / Math.max(image.width, image.height),
    );
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is unavailable.");
    context.drawImage(image.canvas, 0, 0, width, height);
    const source = context.getImageData(0, 0, width, height);
    const prepared = prepareArtworkPixels(source);
    reportPreparationDiagnostics(logo.filename, prepared.diagnostics);
    if (!prepared.diagnostics.validationPassed) {
      throw new Error("Prepared output failed the filled-rectangle safety check.");
    }
    canvas.width = prepared.width;
    canvas.height = prepared.height;
    const output = canvas.getContext("2d");
    if (!output) throw new Error("Canvas is unavailable.");
    output.putImageData(
      new ImageData(
        new Uint8ClampedArray(prepared.data),
        prepared.width,
        prepared.height,
      ),
      0,
      0,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("Artwork export failed."))),
        "image/png",
      ),
    );
    return { blob, ...prepared };
}
