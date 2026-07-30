/**
 * Conservative defaults: a candidate must satisfy every limit. These values
 * intentionally favour preserving ambiguous customer artwork over removing it.
 */
export type ResidualNoiseCleanupConfig = {
  enabled: boolean;
  alphaForegroundThreshold: number;
  maxAbsoluteNoisePixels: number;
  maxRelativeComponentArea: number;
  maxRelativeForegroundArea: number;
  maxNoiseWidth: number;
  maxNoiseHeight: number;
  minimumIsolationDistance: number;
  protectNearbyComponentDistance: number;
  protectedLargestComponentCount: number;
  meaningfulForegroundAreaRatio: number;
};

export const RESIDUAL_NOISE_CLEANUP_CONFIG: ResidualNoiseCleanupConfig = {
  enabled: true,
  alphaForegroundThreshold: 8,
  maxAbsoluteNoisePixels: 4,
  maxRelativeComponentArea: 0.0005,
  maxRelativeForegroundArea: 0.005,
  maxNoiseWidth: 2,
  maxNoiseHeight: 2,
  minimumIsolationDistance: 16,
  protectNearbyComponentDistance: 8,
  protectedLargestComponentCount: 1,
  meaningfulForegroundAreaRatio: 0.01,
};
