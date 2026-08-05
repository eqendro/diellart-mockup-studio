import { analyseArtwork, mapCustomerArtworkState, selectIntakeRoute } from "@/features/artwork-intake";
import type { ArtworkIntakeMetrics, ArtworkClassification } from "@/features/artwork-intake";
import { createMonochromePixels, detectDominantBrandColour } from "@/features/logo-engine/monochrome/pixels";
import { prepareArtwork } from "@/features/logo-engine/preparation/prepare-artwork";
import type { PixelImage } from "@/features/logo-engine/preparation/process-pixels";
import { decodeBlobToCanvas, decodeMobileImage } from "@/features/upload/utils/decode-mobile-image";
import { formatFileSize } from "@/features/upload/utils/file-metadata";
import { validateLogoFile } from "@/features/upload/utils/validate-logo-file";
import type { AcceptedLogo } from "@/features/upload/types/logo-upload";
import type { IntakeRoute } from "@/features/artwork-intake";
import type { RegressionFixtureName } from "./fixture-config";

export type ArtworkRegressionResult = {
  fixtureName: RegressionFixtureName;
  decodeStatus: "succeeded" | "failed";
  orientation: { method: string | null; normalised: boolean; original: string | null; output: string | null; aspectPreserved: boolean | null };
  classification: ArtworkClassification | null;
  route: IntakeRoute | null;
  candidateValidation: {
    valid: boolean;
    transparencyRatio: number;
    foregroundCoverage: number;
    foregroundBounds: { x: number; y: number; width: number; height: number } | null;
    rectangularity: number | null;
    internalHoles: number | null;
    reason: string | null;
  } | null;
  rendererAllowed: boolean;
  detectedColour: { hex: string; confident: boolean; chromaticShare: number } | null;
  metrics: ArtworkIntakeMetrics | null;
  foregroundBounds: { x: number; y: number; width: number; height: number } | null;
  candidateDimensions: string | null;
  finalCustomerState: string;
  preparation: { backgroundRemoved: boolean; backgroundClassification: string } | null;
  processingTimeMs: number;
  pass: boolean;
  failureReasons: string[];
};

export type ArtworkRegressionVisuals = {
  originalUrl: string;
  normalisedUrl: string | null;
  candidateUrl: string | null;
  monochromeUrl: string | null;
};

export type ArtworkRegressionRun = {
  result: ArtworkRegressionResult;
  visuals: ArtworkRegressionVisuals;
  release(): void;
};

const describeError = (error: unknown) => error instanceof Error ? `${error.name}: ${error.message}` : String(error);

function canvasPixels(canvas: HTMLCanvasElement): PixelImage {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D context unavailable.");
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function imageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Original fixture dimensions could not be read."));
    image.src = url;
  });
}

function measureCandidate(image: PixelImage) {
  let foreground = 0;
  let protectedLightPixels = 0;
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  const mask = new Uint8Array(image.width * image.height);
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const index = y * image.width + x;
    if (image.data[index * 4 + 3] <= 20) continue;
    mask[index] = 1;
    foreground++;
    const pixel = index * 4;
    if (image.data[pixel] >= 242 && image.data[pixel + 1] >= 242 && image.data[pixel + 2] >= 242) protectedLightPixels++;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const bounds = maxX < minX ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  let internalHoles = 0;
  if (bounds) {
    const seen = new Uint8Array(mask.length);
    for (let sy = bounds.y; sy < bounds.y + bounds.height; sy++) for (let sx = bounds.x; sx < bounds.x + bounds.width; sx++) {
      const start = sy * image.width + sx;
      if (mask[start] || seen[start]) continue;
      const queue = [start]; seen[start] = 1; let touches = false;
      for (let head = 0; head < queue.length; head++) {
        const current = queue[head]; const x = current % image.width; const y = Math.floor(current / image.width);
        if (x === bounds.x || y === bounds.y || x === bounds.x + bounds.width - 1 || y === bounds.y + bounds.height - 1) touches = true;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (nx < bounds.x || ny < bounds.y || nx >= bounds.x + bounds.width || ny >= bounds.y + bounds.height) continue;
          const next = ny * image.width + nx;
          if (!mask[next] && !seen[next]) { seen[next] = 1; queue.push(next); }
        }
      }
      if (!touches) internalHoles++;
    }
  }
  return {
    bounds,
    foregroundCoverage: foreground / Math.max(1, image.width * image.height),
    transparencyRatio: 1 - foreground / Math.max(1, image.width * image.height),
    rectangularity: bounds ? foreground / (bounds.width * bounds.height) : 0,
    internalHoles: Math.max(internalHoles, protectedLightPixels),
  };
}

function pixelsUrl(image: PixelImage): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable.");
  context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("Canvas export returned null.")),
    "image/png",
  ));
}

function expectedFailures(
  fixtureName: RegressionFixtureName,
  input: Omit<ArtworkRegressionResult, "pass" | "failureReasons" | "processingTimeMs">,
) {
  const reasons: string[] = [];
  if (input.decodeStatus !== "succeeded") reasons.push("Decode failed.");
  if (!input.orientation.normalised) reasons.push("Orientation was not normalised.");
  if (input.orientation.aspectPreserved === false) reasons.push("Normalisation distorted the fixture aspect ratio.");
  const validation = input.candidateValidation;
  const rectangle = validation && (!validation.valid || validation.transparencyRatio < 0.03 || (validation.rectangularity ?? 0) > 0.9);
  if (fixtureName === "diellart.png") {
    if (!validation?.valid) reasons.push("DiellArt candidate is not structurally valid.");
    if (!input.rendererAllowed) reasons.push("DiellArt renderer handoff was blocked.");
  } else if (fixtureName === "xhaura.jpg") {
    if (!input.preparation?.backgroundRemoved) reasons.push("Xh’Aura background was not removed.");
    if (!validation?.valid || rectangle) reasons.push("Xh’Aura became an invalid solid or rectangular candidate.");
    if ((validation?.internalHoles ?? 0) < 1) reasons.push("Xh’Aura internal counters were not detected.");
    if (!input.rendererAllowed) reasons.push("Xh’Aura renderer handoff was blocked.");
  } else if (fixtureName === "aureva.png") {
    if (!input.preparation?.backgroundRemoved) reasons.push("Aureva background was not removed.");
    if (!validation?.valid || rectangle) reasons.push("Aureva retained an invalid opaque rectangle.");
    if (!input.detectedColour?.confident) reasons.push("Aureva detected colour is not confident.");
    if (!input.rendererAllowed) reasons.push("Aureva renderer handoff was blocked.");
  } else if (fixtureName === "raffaello.jpg") {
    if (!input.preparation?.backgroundRemoved) reasons.push("Raffaello red logo was not isolated from the background.");
    if (!validation?.valid || rectangle) reasons.push("Raffaello candidate remains a rectangular crop.");
  } else {
    const safelyAssisted = input.finalCustomerState === "select-logo-area" || input.finalCustomerState === "review-extraction";
    if (input.rendererAllowed && rectangle) reasons.push("Ristorante full photograph reached renderer handoff.");
    if (!input.rendererAllowed && !safelyAssisted) reasons.push("Ristorante did not route to safe assistance/review.");
  }
  return reasons;
}

export async function runArtworkRegressionFixture(
  fixtureName: RegressionFixtureName,
): Promise<ArtworkRegressionRun> {
  const started = performance.now();
  const ownedUrls: string[] = [];
  const originalUrl = `/dev/artwork-regression/fixture/${encodeURIComponent(fixtureName)}`;
  let partial: Omit<ArtworkRegressionResult, "pass" | "failureReasons" | "processingTimeMs"> = {
    fixtureName,
    decodeStatus: "failed",
    orientation: { method: null, normalised: false, original: null, output: null, aspectPreserved: null },
    classification: null,
    route: null,
    candidateValidation: null,
    rendererAllowed: false,
    detectedColour: null,
    metrics: null,
    foregroundBounds: null,
    candidateDimensions: null,
    finalCustomerState: "error-recoverable",
    preparation: null,
  };
  try {
    const response = await fetch(originalUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Fixture fetch failed: ${response.status} ${response.statusText}`);
    const sourceBlob = await response.blob();
    const originalDimensions = await imageDimensions(originalUrl);
    const file = new File([sourceBlob], fixtureName, { type: sourceBlob.type });
    const validation = validateLogoFile(file);
    if (!validation.valid) throw new Error(validation.message);
    const normalised = await decodeMobileImage(file);
    ownedUrls.push(normalised.objectUrl);
    const logo: AcceptedLogo = {
      file,
      sessionId: `regression-${fixtureName}`,
      source: "file-manager",
      ownedBytes: await sourceBlob.arrayBuffer(),
      ownedBlob: sourceBlob,
      normalisedBlob: normalised.blob,
      filename: fixtureName,
      mimeType: file.type,
      extension: validation.extension,
      sizeBytes: file.size,
      formattedSize: formatFileSize(file.size),
      width: normalised.width,
      height: normalised.height,
      aspectRatio: normalised.width / normalised.height,
      previewUrl: normalised.objectUrl,
      decoder: normalised.decoder,
      orientation: normalised.orientation,
      resizedForWorkingCopy: normalised.resized,
    };
    const analysis = await analyseArtwork(logo);
    const route = selectIntakeRoute(analysis);
    let candidate: PixelImage | null = null;
    let candidateValidation: ArtworkRegressionResult["candidateValidation"] = null;
    let candidateUrl: string | null = null;
    let backgroundRemoved = false;
    let backgroundClassification = "not-prepared";
    let processingState: "ready" | "needs-review" | "selecting" | "failed" = "selecting";

    if (analysis.classification === "TransparentLogo") {
      const decoded = await decodeBlobToCanvas(normalised.blob);
      candidate = canvasPixels(decoded.canvas);
      const measured = measureCandidate(candidate);
      candidateUrl = normalised.objectUrl;
      backgroundClassification = "transparent";
      backgroundRemoved = measured.transparencyRatio > 0;
      processingState = "ready";
      candidateValidation = {
        valid: analysis.metrics.transparentRatio > 0,
        transparencyRatio: measured.transparencyRatio,
        foregroundCoverage: measured.foregroundCoverage,
        foregroundBounds: measured.bounds,
        rectangularity: measured.rectangularity,
        internalHoles: measured.internalHoles,
        reason: analysis.metrics.transparentRatio > 0 ? null : "Production analysis found no transparent pixels.",
      };
    } else if (route === "prepare-automatically") {
      try {
        const prepared = await prepareArtwork(logo);
        if (!prepared) throw new Error("Preparation returned no raster candidate.");
        const decodedCandidate = await decodeBlobToCanvas(prepared.blob);
        candidate = canvasPixels(decodedCandidate.canvas);
        const measured = measureCandidate(candidate);
        candidateUrl = await pixelsUrl(candidate);
        ownedUrls.push(candidateUrl);
        backgroundRemoved = prepared.backgroundRemoved;
        backgroundClassification = prepared.backgroundClassification;
        candidateValidation = {
          valid: prepared.diagnostics.validationPassed,
          transparencyRatio: measured.transparencyRatio,
          foregroundCoverage: measured.foregroundCoverage,
          foregroundBounds: measured.bounds,
          rectangularity: measured.rectangularity,
          internalHoles: measured.internalHoles,
          reason: prepared.diagnostics.validationPassed ? null : "Production filled-rectangle safety check failed.",
        };
        processingState = analysis.confidence === "High" ? "ready" : "needs-review";
      } catch {
        processingState = analysis.classification === "LogoOnPlainBackground" ? "selecting" : "failed";
      }
    }

    const detectedColour = candidate ? detectDominantBrandColour(candidate) : null;
    const hasPreparedCandidate = Boolean(candidate && candidateValidation?.valid);
    const customerState = mapCustomerArtworkState({
      hasUpload: true,
      processingState,
      cropOpen: false,
      hasPreparedCandidate,
    });
    const rendererAllowed = customerState.status === "preview-ready" && hasPreparedCandidate;
    let monochromeUrl: string | null = null;
    if (candidate && detectedColour) {
      monochromeUrl = await pixelsUrl(createMonochromePixels(candidate, detectedColour.hex));
      ownedUrls.push(monochromeUrl);
    }
    partial = {
      fixtureName,
      decodeStatus: "succeeded",
      orientation: {
        method: normalised.orientation,
        normalised: normalised.orientation === "browser-decoded",
        original: `${originalDimensions.width}×${originalDimensions.height}`,
        output: `${normalised.width}×${normalised.height}`,
        aspectPreserved: Math.abs(
          originalDimensions.width / originalDimensions.height - normalised.width / normalised.height,
        ) < 0.002,
      },
      classification: analysis.classification,
      route,
      candidateValidation,
      rendererAllowed,
      detectedColour,
      metrics: analysis.metrics,
      foregroundBounds: candidateValidation?.foregroundBounds ?? null,
      candidateDimensions: candidate ? `${candidate.width}×${candidate.height}` : null,
      finalCustomerState: customerState.status,
      preparation: { backgroundRemoved, backgroundClassification },
    };
    const failureReasons = expectedFailures(fixtureName, partial);
    return {
      result: { ...partial, pass: failureReasons.length === 0, failureReasons, processingTimeMs: performance.now() - started },
      visuals: { originalUrl, normalisedUrl: normalised.objectUrl, candidateUrl, monochromeUrl },
      release: () => ownedUrls.forEach((url) => URL.revokeObjectURL(url)),
    };
  } catch (error) {
    const failureReasons = [describeError(error)];
    return {
      result: { ...partial, pass: false, failureReasons, processingTimeMs: performance.now() - started },
      visuals: { originalUrl, normalisedUrl: null, candidateUrl: null, monochromeUrl: null },
      release: () => ownedUrls.forEach((url) => URL.revokeObjectURL(url)),
    };
  }
}

export function determinismSignature(result: ArtworkRegressionResult) {
  return JSON.stringify({
    decodeStatus: result.decodeStatus,
    orientation: result.orientation,
    classification: result.classification,
    route: result.route,
    candidateDimensions: result.candidateDimensions,
    detectedColour: result.detectedColour,
    finalCustomerState: result.finalCustomerState,
    rendererAllowed: result.rendererAllowed,
  });
}
