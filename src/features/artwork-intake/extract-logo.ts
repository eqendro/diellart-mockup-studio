import { detectForegroundBounds, type PixelImage } from "@/features/logo-engine/preparation/process-pixels";
import type { AcceptedLogo } from "@/features/upload/types/logo-upload";
import { decodeBlobToCanvas } from "@/features/upload/utils/decode-mobile-image";

export type ExtractionMode =
  | "dark-on-light"
  | "light-on-dark"
  | "dominant-saturated-colour"
  | "selected-colour"
  | "border-connected-background"
  | "border-colour-distance";
export type Rgb = readonly [number, number, number];

export type ExtractionInputMetrics = {
  borderColour: Rgb;
  borderColours: Rgb[];
  dominantColours: Array<{ colour: Rgb; share: number }>;
  luminance: { minimum: number; maximum: number; mean: number; darkShare: number; lightShare: number };
  edgeDensity: number;
  selectedForeground: Rgb;
};

export type CandidateValidation = ReturnType<typeof validateExtractedLogo>;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const luminance = (red: number, green: number, blue: number) =>
  red * 0.2126 + green * 0.7152 + blue * 0.0722;
const colourDistance = (red: number, green: number, blue: number, colour: Rgb) =>
  Math.hypot(red - colour[0], green - colour[1], blue - colour[2]);
const saturation = (red: number, green: number, blue: number) => {
  const maximum = Math.max(red, green, blue);
  return maximum ? (maximum - Math.min(red, green, blue)) / maximum : 0;
};
const quantise = (value: number) => Math.min(240, Math.round(value / 32) * 32);

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function borderOffsets(image: PixelImage) {
  const offsets: number[] = [];
  const inset = Math.max(1, Math.round(Math.min(image.width, image.height) * 0.025));
  const stride = Math.max(1, Math.round(Math.max(image.width, image.height) / 500));
  for (let x = 0; x < image.width; x += stride) {
    offsets.push((inset * image.width + x) * 4, ((image.height - 1 - inset) * image.width + x) * 4);
  }
  for (let y = inset; y < image.height - inset; y += stride) {
    offsets.push((y * image.width + inset) * 4, (y * image.width + image.width - 1 - inset) * 4);
  }
  return offsets;
}

export function analyseExtractionInput(image: PixelImage): ExtractionInputMetrics {
  const borders = borderOffsets(image);
  const borderColour = [0, 1, 2].map((channel) => median(borders.map((offset) => image.data[offset + channel]))) as unknown as Rgb;
  const borderBuckets = new Map<string, number>();
  for (const offset of borders) {
    const key = `${quantise(image.data[offset])},${quantise(image.data[offset + 1])},${quantise(image.data[offset + 2])}`;
    borderBuckets.set(key, (borderBuckets.get(key) ?? 0) + 1);
  }
  const borderColours = [...borderBuckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([key]) => key.split(",").map(Number) as unknown as Rgb);
  const buckets = new Map<string, number>();
  let minimum = 255; let maximum = 0; let total = 0; let dark = 0; let light = 0; let edges = 0; let comparisons = 0;
  const stride = Math.max(1, Math.round(Math.sqrt((image.width * image.height) / 250_000)));
  for (let y = 0; y < image.height; y += stride) for (let x = 0; x < image.width; x += stride) {
    const offset = (y * image.width + x) * 4;
    const red = image.data[offset]; const green = image.data[offset + 1]; const blue = image.data[offset + 2];
    const value = luminance(red, green, blue);
    minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); total += value;
    if (value < 80) dark++; if (value > 205) light++;
    const key = `${quantise(red)},${quantise(green)},${quantise(blue)}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
    if (x + stride < image.width) {
      const next = offset + stride * 4;
      if (colourDistance(red, green, blue, [image.data[next], image.data[next + 1], image.data[next + 2]]) > 42) edges++;
      comparisons++;
    }
    if (y + stride < image.height) {
      const next = offset + stride * image.width * 4;
      if (colourDistance(red, green, blue, [image.data[next], image.data[next + 1], image.data[next + 2]]) > 42) edges++;
      comparisons++;
    }
  }
  const samples = Math.max(1, Math.ceil(image.width / stride) * Math.ceil(image.height / stride));
  const dominantColours = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key, count]) => ({
    colour: key.split(",").map(Number) as unknown as Rgb,
    share: count / samples,
  }));
  const selectedForeground = dominantColours
    .filter(({ colour }) => saturation(...colour) > 0.22 && colourDistance(...colour, borderColour) > 38)
    .sort((a, b) => (saturation(...b.colour) * Math.sqrt(b.share)) - (saturation(...a.colour) * Math.sqrt(a.share)))[0]?.colour ??
    dominantColours.sort((a, b) => colourDistance(...b.colour, borderColour) - colourDistance(...a.colour, borderColour))[0]?.colour ?? [0, 0, 0];
  return {
    borderColour,
    borderColours: borderColours.length ? borderColours : [borderColour],
    dominantColours,
    luminance: { minimum, maximum, mean: total / samples, darkShare: dark / samples, lightShare: light / samples },
    edgeDensity: edges / Math.max(1, comparisons),
    selectedForeground,
  };
}

function nearestBorderDistance(red: number, green: number, blue: number, metrics: ExtractionInputMetrics) {
  return Math.min(...metrics.borderColours.map((colour) => colourDistance(red, green, blue, colour)));
}

export function extractLogoPixels(
  input: PixelImage,
  mode: ExtractionMode,
  selected?: Rgb,
  suppliedMetrics?: ExtractionInputMetrics,
): PixelImage {
  const metrics = suppliedMetrics ?? analyseExtractionInput(input);
  const foreground = selected ?? metrics.selectedForeground;
  const data = new Uint8ClampedArray(input.data);
  if (mode === "border-connected-background") {
    const background = new Uint8Array(input.width * input.height);
    const queued = new Uint8Array(background.length);
    const queue: number[] = [];
    const enqueue = (index: number) => {
      if (!queued[index]) { queued[index] = 1; queue.push(index); }
    };
    for (let x = 0; x < input.width; x++) { enqueue(x); enqueue((input.height - 1) * input.width + x); }
    for (let y = 1; y < input.height - 1; y++) { enqueue(y * input.width); enqueue(y * input.width + input.width - 1); }
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head]; const offset = index * 4;
      const red = input.data[offset]; const green = input.data[offset + 1]; const blue = input.data[offset + 2];
      if (nearestBorderDistance(red, green, blue, metrics) > 58) continue;
      background[index] = 1;
      const x = index % input.width; const y = Math.floor(index / input.width);
      for (const next of [x ? index - 1 : -1, x + 1 < input.width ? index + 1 : -1, y ? index - input.width : -1, y + 1 < input.height ? index + input.width : -1]) {
        if (next < 0 || queued[next]) continue;
        const nextOffset = next * 4;
        if (colourDistance(red, green, blue, [input.data[nextOffset], input.data[nextOffset + 1], input.data[nextOffset + 2]]) <= 34) enqueue(next);
      }
    }
    for (let index = 0; index < background.length; index++) {
      const offset = index * 4;
      data[offset + 3] = background[index] ? 0 : Math.round(255 * clamp((nearestBorderDistance(data[offset], data[offset + 1], data[offset + 2], metrics) - 8) / 42));
    }
    return { data, width: input.width, height: input.height };
  }
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset]; const green = data[offset + 1]; const blue = data[offset + 2];
    const value = luminance(red, green, blue);
    let strength: number;
    if (mode === "dark-on-light") strength = (190 - value) / 90;
    else if (mode === "light-on-dark") strength = (value - 65) / 110;
    else if (mode === "dominant-saturated-colour") {
      strength = Math.min((saturation(red, green, blue) - 0.12) / 0.28, (105 - colourDistance(red, green, blue, foreground)) / 65);
    } else if (mode === "selected-colour") strength = (115 - colourDistance(red, green, blue, foreground)) / 75;
    else strength = (colourDistance(red, green, blue, metrics.borderColour) - 25) / 65;
    data[offset + 3] = Math.round(255 * clamp(strength));
  }
  return { data, width: input.width, height: input.height };
}

function componentMetrics(image: PixelImage, threshold = 20) {
  const mask = new Uint8Array(image.width * image.height);
  for (let index = 0; index < mask.length; index++) mask[index] = image.data[index * 4 + 3] > threshold ? 1 : 0;
  const seen = new Uint8Array(mask.length);
  const areas: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start]; seen[start] = 1; let area = 0;
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head]; area++;
      const x = current % image.width; const y = Math.floor(current / image.width);
      for (const next of [x ? current - 1 : -1, x + 1 < image.width ? current + 1 : -1, y ? current - image.width : -1, y + 1 < image.height ? current + image.width : -1]) {
        if (next >= 0 && mask[next] && !seen[next]) { seen[next] = 1; queue.push(next); }
      }
    }
    areas.push(area);
  }
  areas.sort((a, b) => b - a);
  const foreground = areas.reduce((sum, area) => sum + area, 0);
  return { count: areas.filter((area) => area >= Math.max(4, foreground * 0.0002)).length, dominantShare: foreground ? (areas[0] ?? 0) / foreground : 0 };
}

function countInternalHoles(image: PixelImage, bounds: ReturnType<typeof detectForegroundBounds>, threshold = 20) {
  if (!bounds) return 0;
  const seen = new Uint8Array(image.width * image.height);
  let holes = 0;
  for (let startY = bounds.y; startY < bounds.y + bounds.height; startY++) for (let startX = bounds.x; startX < bounds.x + bounds.width; startX++) {
    const start = startY * image.width + startX;
    if (seen[start] || image.data[start * 4 + 3] > threshold) continue;
    const queue = [start]; seen[start] = 1; let touchesBounds = false;
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head]; const x = current % image.width; const y = Math.floor(current / image.width);
      if (x === bounds.x || y === bounds.y || x === bounds.x + bounds.width - 1 || y === bounds.y + bounds.height - 1) touchesBounds = true;
      for (const next of [x > bounds.x ? current - 1 : -1, x + 1 < bounds.x + bounds.width ? current + 1 : -1, y > bounds.y ? current - image.width : -1, y + 1 < bounds.y + bounds.height ? current + image.width : -1]) {
        if (next >= 0 && !seen[next] && image.data[next * 4 + 3] <= threshold) { seen[next] = 1; queue.push(next); }
      }
    }
    if (!touchesBounds) holes++;
  }
  return holes;
}

export function validateExtractedLogo(image: PixelImage) {
  let foreground = 0; let edgeForeground = 0; let alphaTotal = 0; let strongForeground = 0;
  for (let offset = 3; offset < image.data.length; offset += 4) {
    const alpha = image.data[offset]; alphaTotal += alpha;
    if (alpha > 20) {
      foreground++; if (alpha > 180) strongForeground++;
      const pixel = (offset - 3) / 4; const x = pixel % image.width; const y = Math.floor(pixel / image.width);
      if (x === 0 || y === 0 || x === image.width - 1 || y === image.height - 1) edgeForeground++;
    }
  }
  const pixels = image.width * image.height;
  const foregroundRatio = foreground / pixels;
  const transparencyRatio = 1 - foregroundRatio;
  const bounds = detectForegroundBounds(image, 20);
  const boundsRatio = bounds ? (bounds.width * bounds.height) / pixels : 0;
  const rectangularity = bounds ? foreground / (bounds.width * bounds.height) : 0;
  const perimeter = Math.max(1, image.width * 2 + image.height * 2 - 4);
  const edgeContact = edgeForeground / perimeter;
  const components = componentMetrics(image);
  const internalHoles = countInternalHoles(image, bounds);
  const reasons: string[] = [];
  if (!bounds || foregroundRatio < 0.002 || strongForeground / pixels < 0.0005) reasons.push("almost-empty");
  if (foregroundRatio > 0.84 || transparencyRatio < 0.08) reasons.push("almost-opaque");
  if (boundsRatio > 0.97 && rectangularity > 0.88) reasons.push("solid-rectangle");
  if (edgeContact > 0.88 && boundsRatio > 0.96) reasons.push("full-crop-edge-contact");
  if (components.dominantShare > 0.985 && rectangularity > 0.86 && boundsRatio > 0.9) reasons.push("dominant-background-field");
  const valid = reasons.length === 0;
  return {
    valid,
    foregroundRatio,
    transparencyRatio,
    edgeContact,
    boundsRatio,
    rectangularity,
    connectedComponentCount: components.count,
    dominantComponentArea: components.dominantShare,
    internalHoles,
    meanAlpha: alphaTotal / pixels / 255,
    bounds,
    rejectionReasons: reasons,
    reason: valid ? null : `Candidate rejected: ${reasons.join(", ")}.`,
  };
}

export type ExtractionCandidate = {
  id: ExtractionMode;
  blob: Blob;
  validation: CandidateValidation;
  confidence: number;
  inputMetrics: ExtractionInputMetrics;
};

export function scoreExtractionCandidate(validation: CandidateValidation, input: ExtractionInputMetrics) {
  if (!validation.valid) return -1;
  const coverage = 1 - Math.min(1, Math.abs(validation.foregroundRatio - 0.2) / 0.35);
  const compactness = 1 - Math.min(1, Math.abs(validation.rectangularity - 0.35) / 0.65);
  const separation = 1 - Math.min(1, validation.edgeContact);
  const componentPlausibility = validation.connectedComponentCount >= 1 && validation.connectedComponentCount <= 120 ? 1 : 0.35;
  const dominantPlausibility = validation.dominantComponentArea < 0.97 ? 1 : 0.2;
  const textStructure = Math.min(1, input.edgeDensity * 8 + Math.min(validation.connectedComponentCount, 12) / 18);
  const internalStructure = Math.min(1, validation.internalHoles / 4);
  const colourSeparation = Math.min(1, colourDistance(...input.selectedForeground, input.borderColour) / 120);
  const transparency = validation.transparencyRatio > 0.18 && validation.transparencyRatio < 0.995 ? 1 : 0.4;
  return coverage * 0.17 + compactness * 0.13 + separation * 0.15 + componentPlausibility * 0.1 +
    dominantPlausibility * 0.1 + textStructure * 0.12 + transparency * 0.08 + internalStructure * 0.07 + colourSeparation * 0.08;
}

export async function createExtractionCandidates(logo: AcceptedLogo): Promise<ExtractionCandidate[]> {
  const results = await createAllExtractionCandidates(logo);
  return results.filter((candidate) => candidate.validation.valid).sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

export async function createAllExtractionCandidates(logo: AcceptedLogo): Promise<ExtractionCandidate[]> {
  if (!logo.normalisedBlob) throw new Error("NORMALISED_IMAGE_REQUIRED: extraction cannot decode the original upload.");
  const decoded = await decodeBlobToCanvas(logo.normalisedBlob);
  const context = decoded.canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Logo separation is unavailable.");
  const input = context.getImageData(0, 0, decoded.width, decoded.height);
  const metrics = analyseExtractionInput(input);
  const modes: ExtractionMode[] = [
    "dark-on-light", "light-on-dark", "dominant-saturated-colour", "selected-colour",
    "border-connected-background", "border-colour-distance",
  ];
  const results = await Promise.all(modes.map(async (mode) => {
    const result = await createExtractedLogo(logo, mode, metrics.selectedForeground, input, metrics);
    return { id: mode, ...result, confidence: scoreExtractionCandidate(result.validation, metrics), inputMetrics: metrics };
  }));
  return results.sort((a, b) => b.confidence - a.confidence);
}

export async function createExtractedLogo(
  logo: AcceptedLogo,
  mode: ExtractionMode,
  selected?: Rgb,
  suppliedInput?: PixelImage,
  suppliedMetrics?: ExtractionInputMetrics,
) {
  if (!logo.normalisedBlob) throw new Error("NORMALISED_IMAGE_REQUIRED: extraction cannot decode the original upload.");
  const bitmap = suppliedInput ? null : await decodeBlobToCanvas(logo.normalisedBlob);
  const input = suppliedInput ?? (() => {
    const source = bitmap!.canvas.getContext("2d", { willReadFrequently: true });
    if (!source) throw new Error("Logo separation is unavailable.");
    return source.getImageData(0, 0, bitmap!.width, bitmap!.height);
  })();
  const extracted = extractLogoPixels(input, mode, selected, suppliedMetrics);
  const validation = validateExtractedLogo(extracted);
  const canvas = document.createElement("canvas"); canvas.width = input.width; canvas.height = input.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Logo separation is unavailable.");
  const output = context.createImageData(extracted.width, extracted.height); output.data.set(extracted.data); context.putImageData(output, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error("Logo preview export failed.")), "image/png",
  ));
  return { blob, validation };
}
