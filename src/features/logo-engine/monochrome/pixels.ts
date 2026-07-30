import { MONOCHROME_CONFIG } from "@/features/logo-engine/monochrome/config";

export type RasterPixels = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type DetectedBrandColour = {
  hex: string;
  confident: boolean;
  chromaticShare: number;
};

const toHex = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");

export function hexToRgb(hex: string): [number, number, number] {
  const normalised = hex.replace("#", "");
  return [
    Number.parseInt(normalised.slice(0, 2), 16),
    Number.parseInt(normalised.slice(2, 4), 16),
    Number.parseInt(normalised.slice(4, 6), 16),
  ];
}

function rgbToHsv(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta) {
    if (maximum === r) hue = 60 * (((g - b) / delta) % 6);
    else if (maximum === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return {
    hue,
    saturation: maximum ? delta / maximum : 0,
    value: maximum,
  };
}

export function detectDominantBrandColour(
  image: RasterPixels,
  config = MONOCHROME_CONFIG,
): DetectedBrandColour {
  const clusters = new Map<
    string,
    { weight: number; red: number; green: number; blue: number }
  >();
  let eligibleWeight = 0;
  let chromaticWeight = 0;

  for (let offset = 0; offset < image.data.length; offset += 4) {
    const alpha = image.data[offset + 3];
    if (alpha < config.minimumAlpha) continue;
    const red = image.data[offset];
    const green = image.data[offset + 1];
    const blue = image.data[offset + 2];
    if (
      red >= config.nearWhiteMinimum &&
      green >= config.nearWhiteMinimum &&
      blue >= config.nearWhiteMinimum
    ) continue;
    const weight = alpha / 255;
    eligibleWeight += weight;
    const hsv = rgbToHsv(red, green, blue);
    if (
      hsv.saturation < config.minimumChromaticSaturation ||
      hsv.value < config.minimumChromaticValue
    ) continue;
    chromaticWeight += weight;
    const key = [
      Math.floor(hsv.hue / config.hueBucketDegrees),
      Math.floor(hsv.saturation * config.saturationBuckets),
      Math.floor(hsv.value * config.valueBuckets),
    ].join(":");
    const cluster = clusters.get(key) ?? {
      weight: 0,
      red: 0,
      green: 0,
      blue: 0,
    };
    cluster.weight += weight;
    cluster.red += red * weight;
    cluster.green += green * weight;
    cluster.blue += blue * weight;
    clusters.set(key, cluster);
  }

  const strongest = [...clusters.values()].sort((a, b) => b.weight - a.weight)[0];
  const chromaticShare = eligibleWeight ? chromaticWeight / eligibleWeight : 0;
  const clusterConfidence =
    strongest && chromaticWeight ? strongest.weight / chromaticWeight : 0;
  const confident = Boolean(
    strongest &&
      chromaticShare >= config.minimumChromaticShare &&
      clusterConfidence >= config.minimumClusterConfidence,
  );
  if (!strongest || !confident) {
    return { hex: "#000000", confident: false, chromaticShare };
  }
  return {
    hex: `#${toHex(strongest.red / strongest.weight)}${toHex(
      strongest.green / strongest.weight,
    )}${toHex(strongest.blue / strongest.weight)}`.toUpperCase(),
    confident: true,
    chromaticShare,
  };
}

export function createMonochromePixels(
  image: RasterPixels,
  targetHex: string,
): RasterPixels {
  const [red, green, blue] = hexToRgb(targetHex);
  const data = new Uint8ClampedArray(image.data);
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) continue;
    if (
      data[offset] >= MONOCHROME_CONFIG.nearWhiteMinimum &&
      data[offset + 1] >= MONOCHROME_CONFIG.nearWhiteMinimum &&
      data[offset + 2] >= MONOCHROME_CONFIG.nearWhiteMinimum
    ) {
      continue;
    }
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
  }
  return { data, width: image.width, height: image.height };
}
