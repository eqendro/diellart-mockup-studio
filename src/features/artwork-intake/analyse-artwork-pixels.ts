import { ARTWORK_INTAKE_CONFIG } from "@/features/artwork-intake/config";
import type {
  ArtworkIntakeMetrics,
  ArtworkIntakeResult,
} from "@/features/artwork-intake/types";
import type { PixelImage } from "@/features/logo-engine/preparation/process-pixels";

const luminance = (r: number, g: number, b: number) =>
  (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;

function measure(image: PixelImage): ArtworkIntakeMetrics {
  let transparent = 0;
  let sum = 0;
  let sumSquares = 0;
  let edges = 0;
  const buckets = new Set<number>();
  const borderColours: Array<[number, number, number]> = [];
  const stride = Math.max(1, Math.round(Math.max(image.width, image.height) / 320));
  const at = (x: number, y: number) => (y * image.width + x) * 4;

  for (let y = 0; y < image.height; y += stride) {
    for (let x = 0; x < image.width; x += stride) {
      const offset = at(x, y);
      const alpha = image.data[offset + 3];
      if (alpha < 245) transparent++;
      const value = luminance(image.data[offset], image.data[offset + 1], image.data[offset + 2]);
      sum += value;
      sumSquares += value * value;
      buckets.add(
        (Math.floor(image.data[offset] / 32) << 6) |
          (Math.floor(image.data[offset + 1] / 32) << 3) |
          Math.floor(image.data[offset + 2] / 32),
      );
      if (x + stride < image.width) {
        const next = at(x + stride, y);
        const nextLuminance = luminance(image.data[next], image.data[next + 1], image.data[next + 2]);
        if (Math.abs(value - nextLuminance) > 0.12) edges++;
      }
      if (y + stride < image.height) {
        const next = at(x, y + stride);
        const nextLuminance = luminance(image.data[next], image.data[next + 1], image.data[next + 2]);
        if (Math.abs(value - nextLuminance) > 0.12) edges++;
      }
      if (x === 0 || y === 0 || x + stride >= image.width || y + stride >= image.height) {
        borderColours.push([image.data[offset], image.data[offset + 1], image.data[offset + 2]]);
      }
    }
  }

  const sampled = Math.ceil(image.width / stride) * Math.ceil(image.height / stride);
  const borderMean = [0, 1, 2].map(
    (channel) =>
      borderColours.reduce((total, colour) => total + colour[channel], 0) /
      Math.max(1, borderColours.length),
  );
  const borderUniformity =
    borderColours.filter((colour) => {
      const distance = Math.sqrt(
        (colour[0] - borderMean[0]) ** 2 +
          (colour[1] - borderMean[1]) ** 2 +
          (colour[2] - borderMean[2]) ** 2,
      );
      return distance < 34;
    }).length / Math.max(1, borderColours.length);
  const mean = sum / sampled;
  return {
    transparentRatio: transparent / sampled,
    borderUniformity,
    borderLightness: luminance(borderMean[0], borderMean[1], borderMean[2]),
    colourBucketRatio: buckets.size / Math.min(sampled, 512),
    luminanceVariance: Math.max(0, sumSquares / sampled - mean * mean),
    edgeComplexity: edges / Math.max(1, sampled * 2),
    aspectRatio: image.width / image.height,
  };
}

const near = (value: number, target: number, tolerance: number) =>
  Math.abs(value - target) <= tolerance;

export function analyseArtworkPixels(image: PixelImage): ArtworkIntakeResult {
  const metrics = measure(image);
  const config = ARTWORK_INTAKE_CONFIG;
  if (metrics.transparentRatio >= config.transparentLogoRatio) {
    return {
      classification: "TransparentLogo",
      confidence: metrics.transparentRatio > 0.2 ? "High" : "Medium",
      recommendedWorkflow: "NoPreparation",
      reason: "The artwork already has a clear background.",
      warnings: [],
      metrics,
      requiresCrop: false,
    };
  }

  const plainLightBorder =
    metrics.borderUniformity >= config.plainBorderUniformity &&
    metrics.borderLightness >= config.plainBorderLightness;
  const plainDarkBorder =
    metrics.borderUniformity >= config.plainBorderUniformity &&
    metrics.borderLightness <= 0.18;
  const slideRatio =
    near(metrics.aspectRatio, 16 / 9, config.slideAspectTolerance) ||
    near(metrics.aspectRatio, 4 / 3, config.slideAspectTolerance);
  if (
    plainLightBorder &&
    slideRatio &&
    metrics.edgeComplexity >= config.documentMinimumEdgeComplexity &&
    metrics.edgeComplexity <= config.documentMaximumEdgeComplexity
  ) {
    return {
      classification: "Document",
      confidence: "Medium",
      recommendedWorkflow: "CropRequired",
      preparationAfterCrop: "BackgroundRemoval",
      reason: "The layout resembles a page or presentation export.",
      warnings: ["The next step will allow you to select your logo."],
      metrics,
      requiresCrop: true,
    };
  }
  if (
    metrics.colourBucketRatio >= config.photographColourBucketRatio &&
    metrics.luminanceVariance >= config.photographLuminanceVariance &&
    metrics.edgeComplexity >= config.photographEdgeComplexity
  ) {
    return {
      classification: "Photograph",
      confidence: "High",
      recommendedWorkflow: "CropRequired",
      reason: "The image contains photograph-like colour and detail.",
      warnings: ["The next step will allow you to select your logo."],
      metrics,
      requiresCrop: true,
    };
  }
  if (
    !plainLightBorder &&
    metrics.colourBucketRatio >= config.screenshotColourBucketRatio &&
    metrics.edgeComplexity >= config.screenshotEdgeComplexity
  ) {
    return {
      classification: "Screenshot",
      confidence: "Medium",
      recommendedWorkflow: "CropRequired",
      preparationAfterCrop: "BackgroundRemoval",
      reason: "The image resembles a screen capture with interface detail.",
      warnings: ["The next step will allow you to select your logo."],
      metrics,
      requiresCrop: true,
    };
  }
  if (plainLightBorder || plainDarkBorder) {
    return {
      classification: "LogoOnPlainBackground",
      confidence: metrics.borderUniformity > 0.92 ? "High" : "Medium",
      recommendedWorkflow: "BackgroundRemoval",
      reason: `A logo on a plain ${plainDarkBorder ? "dark" : "light"} background was detected.`,
      warnings: [],
      metrics,
      requiresCrop: false,
    };
  }
  return {
    classification: "Unknown",
    confidence: "Low",
    recommendedWorkflow: "ManualReview",
    reason: "The artwork type could not be identified confidently.",
    warnings: ["The original artwork will be kept for review."],
    metrics,
    requiresCrop: false,
  };
}
