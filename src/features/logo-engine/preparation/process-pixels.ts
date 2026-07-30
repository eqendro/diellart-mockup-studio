import {
  ARTWORK_PREPARATION_CONFIG,
  type ArtworkPreparationConfig,
} from "@/features/logo-engine/preparation/config";

export type PixelImage = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type ForegroundBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PreparationDiagnostics = {
  originalWidth: number;
  originalHeight: number;
  preparedWidth: number;
  preparedHeight: number;
  foregroundBounds: ForegroundBounds | null;
  foregroundPercent: number;
  transparentPercent: number;
  paddingApplied: number;
  validationPassed: boolean;
  cleanupPassUsed: boolean;
};

export type PreparedPixels = PixelImage & {
  backgroundRemoved: boolean;
  marginsCropped: boolean;
  backgroundClassification:
    | "transparent"
    | "removable-light-background"
    | "non-removable-background";
  veryLight: boolean;
  foregroundBounds: ForegroundBounds;
  diagnostics: PreparationDiagnostics;
};

const pixelOffset = (x: number, y: number, width: number) => (y * width + x) * 4;

function colourDistance(
  data: Uint8ClampedArray,
  offset: number,
  colour: readonly [number, number, number],
) {
  return Math.sqrt(
    (data[offset] - colour[0]) ** 2 +
      (data[offset + 1] - colour[1]) ** 2 +
      (data[offset + 2] - colour[2]) ** 2,
  );
}

function estimateBorder(
  image: PixelImage,
  config: ArtworkPreparationConfig,
): { colour: readonly [number, number, number]; tolerance: number } | null {
  const samples: number[] = [];
  const segments = Array.from({ length: 8 }, () => [] as number[]);
  const add = (x: number, y: number, segment: number) => {
    const offset = pixelOffset(x, y, image.width);
    samples.push(offset);
    segments[segment].push(offset);
  };
  const stride = Math.max(1, config.borderSampleStride);

  for (let x = 0; x < image.width; x += stride) {
    const half = x < image.width / 2 ? 0 : 1;
    add(x, 0, half);
    add(x, image.height - 1, 2 + half);
  }
  for (let y = stride; y < image.height - 1; y += stride) {
    const half = y < image.height / 2 ? 0 : 1;
    add(0, y, 4 + half);
    add(image.width - 1, y, 6 + half);
  }

  const opaque = samples.filter((offset) => image.data[offset + 3] > 245);
  if (!opaque.length) return null;
  const segmentColours = segments
    .map((segment) => segment.filter((offset) => image.data[offset + 3] > 245))
    .filter((segment) => segment.length)
    .map((segment) =>
      [0, 1, 2].map((channel) =>
        Math.round(
          segment.reduce((sum, offset) => sum + image.data[offset + channel], 0) /
            segment.length,
        ),
      ),
    );
  const mean = [0, 1, 2].map((channel) => {
    const values = segmentColours.map((colour) => colour[channel]).sort((a, b) => a - b);
    return Math.round(values[Math.floor(values.length / 2)]);
  }) as [number, number, number];
  const nearWhite = opaque.filter(
    (offset) =>
      image.data[offset] >= config.nearWhiteMinimum &&
      image.data[offset + 1] >= config.nearWhiteMinimum &&
      image.data[offset + 2] >= config.nearWhiteMinimum,
  ).length / opaque.length;
  const uniform = opaque.filter(
    (offset) => colourDistance(image.data, offset, mean) <= config.borderColourTolerance,
  ).length / opaque.length;
  const variation = Math.sqrt(
    opaque.reduce((sum, offset) => sum + colourDistance(image.data, offset, mean) ** 2, 0) /
      opaque.length,
  );

  return nearWhite >= config.minimumNearWhiteBorderRatio &&
    uniform >= config.minimumUniformBorderRatio
    ? {
        colour: mean,
        tolerance: Math.min(
          config.maximumConnectedTolerance,
          Math.max(
            config.connectedColourTolerance,
            config.borderColourTolerance + variation * config.adaptiveToleranceMultiplier,
          ),
        ),
      }
    : null;
}

function removeConnectedBackground(
  image: PixelImage,
  background: readonly [number, number, number],
  tolerance: number,
  config: ArtworkPreparationConfig,
) {
  const { data, width, height } = image;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const enqueue = (x: number, y: number) => {
    const index = y * width + x;
    if (visited[index]) return;
    const offset = index * 4;
    if (
      data[offset + 3] === 0 ||
      colourDistance(data, offset, background) <= tolerance
    ) {
      visited[index] = 1;
      queue[tail++] = index;
    }
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    const offset = index * 4;
    const distance = colourDistance(data, offset, background);
    data[offset + 3] = Math.min(
      data[offset + 3],
      Math.round(255 * Math.max(0, (distance - tolerance) / config.featherDistance)),
    );
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }
}

function isVeryLightArtwork(image: PixelImage, config: ArtworkPreparationConfig) {
  let count = 0;
  let dark = 0;
  let luminance = 0;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] <= config.cropAlphaThreshold) continue;
    const value =
      image.data[offset] * 0.2126 +
      image.data[offset + 1] * 0.7152 +
      image.data[offset + 2] * 0.0722;
    luminance += value;
    count++;
    if (value < config.veryLightLuminance) dark++;
  }
  return count > 0 &&
    luminance / count >= config.veryLightLuminance &&
    dark / count <= config.veryLightDarkPixelRatio;
}

export function detectForegroundBounds(
  image: PixelImage,
  alphaThreshold: number,
): ForegroundBounds | null {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[pixelOffset(x, y, image.width) + 3] > alphaThreshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return maxX < minX
    ? null
    : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function cropTransparentMargins(
  image: PixelImage,
  config: ArtworkPreparationConfig,
): PixelImage & {
  cropped: boolean;
  foregroundBounds: ForegroundBounds | null;
  padding: number;
} {
  const bounds = detectForegroundBounds(image, config.cropAlphaThreshold);
  if (!bounds) return { ...image, cropped: false, foregroundBounds: null, padding: 0 };
  const padding = Math.min(
    config.maximumCropPaddingPx,
    Math.max(
      config.minimumCropPaddingPx,
      Math.round(Math.max(bounds.width, bounds.height) * config.cropPaddingRatio),
    ),
  );
  if (process.env.NODE_ENV !== "production" && !Number.isFinite(padding)) {
    console.error(
      "[artwork-preparation-contract]",
      JSON.stringify({
        bounds,
        cropPaddingRatio: config.cropPaddingRatio,
        minimumCropPaddingPx: config.minimumCropPaddingPx,
        maximumCropPaddingPx: config.maximumCropPaddingPx,
      }),
    );
  }
  let minX = bounds.x;
  let minY = bounds.y;
  let maxX = bounds.x + bounds.width - 1;
  let maxY = bounds.y + bounds.height - 1;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(image.width - 1, maxX + padding);
  maxY = Math.min(image.height - 1, maxY + padding);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const outputBounds = {
    x: bounds.x - minX,
    y: bounds.y - minY,
    width: bounds.width,
    height: bounds.height,
  };
  if (width === image.width && height === image.height) {
    return { ...image, cropped: false, foregroundBounds: outputBounds, padding };
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const start = pixelOffset(minX, minY + y, image.width);
    data.set(image.data.subarray(start, start + width * 4), y * width * 4);
  }
  return { data, width, height, cropped: true, foregroundBounds: outputBounds, padding };
}

function validateForegroundOnly(
  image: PixelImage,
  bounds: ForegroundBounds | null,
  config: ArtworkPreparationConfig,
) {
  if (!bounds) return false;
  let opaque = 0;
  let sum = 0;
  let sumSquares = 0;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] <= config.cropAlphaThreshold) continue;
    opaque++;
    const luminance =
      image.data[offset] * 0.2126 +
      image.data[offset + 1] * 0.7152 +
      image.data[offset + 2] * 0.0722;
    sum += luminance;
    sumSquares += luminance * luminance;
  }
  const pixels = image.width * image.height;
  const opaqueRatio = opaque / pixels;
  const rectangularCoverage = (bounds.width * bounds.height) / pixels;
  const variance = opaque ? Math.max(0, sumSquares / opaque - (sum / opaque) ** 2) : 0;
  const suspicious =
    opaqueRatio > config.validationOpaqueRatio &&
    rectangularCoverage > config.validationRectangularCoverage &&
    Math.sqrt(variance) < config.validationMaximumColourStdDev;
  return !suspicious;
}

function calculateCoverage(image: PixelImage, alphaThreshold: number) {
  let foreground = 0;
  let transparent = 0;
  for (let offset = 3; offset < image.data.length; offset += 4) {
    if (image.data[offset] > alphaThreshold) foreground++;
    else transparent++;
  }
  const pixels = image.width * image.height;
  return {
    foregroundPercent: foreground / pixels,
    transparentPercent: transparent / pixels,
  };
}

export function prepareArtworkPixels(
  input: PixelImage,
  config: ArtworkPreparationConfig = ARTWORK_PREPARATION_CONFIG,
): PreparedPixels {
  // ImageData exposes width/height as prototype getters in browsers, so object
  // spread silently drops them. Copy all three fields explicitly.
  const working: PixelImage = {
    data: new Uint8ClampedArray(input.data),
    width: input.width,
    height: input.height,
  };
  const hasTransparentBorder = (() => {
    for (let x = 0; x < working.width; x++) {
      if (working.data[pixelOffset(x, 0, working.width) + 3] < 245) return true;
      if (working.data[pixelOffset(x, working.height - 1, working.width) + 3] < 245) return true;
    }
    return false;
  })();
  const background = estimateBorder(working, config);
  if (background) {
    removeConnectedBackground(working, background.colour, background.tolerance, config);
  }
  const cropped = cropTransparentMargins(working, config);
  const validationPassed = hasTransparentBorder
    ? true
    : validateForegroundOnly(cropped, cropped.foregroundBounds, config);
  const cleanupPassUsed = false;
  const foregroundBounds = cropped.foregroundBounds ?? {
    x: 0,
    y: 0,
    width: cropped.width,
    height: cropped.height,
  };
  const coverage = calculateCoverage(cropped, config.cropAlphaThreshold);
  return {
    data: cropped.data,
    width: cropped.width,
    height: cropped.height,
    backgroundRemoved: Boolean(background),
    marginsCropped: cropped.cropped,
    backgroundClassification: hasTransparentBorder
      ? "transparent"
      : background
        ? "removable-light-background"
        : "non-removable-background",
    veryLight: isVeryLightArtwork(cropped, config),
    foregroundBounds,
    diagnostics: {
      originalWidth: input.width,
      originalHeight: input.height,
      preparedWidth: cropped.width,
      preparedHeight: cropped.height,
      foregroundBounds: cropped.foregroundBounds,
      ...coverage,
      paddingApplied: cropped.padding,
      validationPassed,
      cleanupPassUsed,
    },
  };
}
