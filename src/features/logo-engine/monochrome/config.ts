export const MONOCHROME_CONFIG = {
  minimumAlpha: 32,
  nearWhiteMinimum: 242,
  minimumChromaticSaturation: 0.22,
  minimumChromaticValue: 0.16,
  minimumChromaticShare: 0.08,
  minimumClusterConfidence: 0.28,
  hueBucketDegrees: 15,
  saturationBuckets: 4,
  valueBuckets: 4,
} as const;

export const PRINT_COLOURS = {
  black: "#000000",
  // Provisional production ink values; confirm against DiellArt's physical ink catalogue.
  blue: "#0057B8",
  green: "#00843D",
} as const;

export type PrintColourKey = "brand" | keyof typeof PRINT_COLOURS;
