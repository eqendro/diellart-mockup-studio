import {
  RESIDUAL_NOISE_CLEANUP_CONFIG,
  type ResidualNoiseCleanupConfig,
} from "@/features/logo-engine/preparation/residual-noise-config";
import type { RasterPixels } from "@/features/logo-engine/monochrome/pixels";

export type ResidualNoiseComponentMetrics = {
  id: number;
  pixelCount: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  areaRatio: number;
  foregroundAreaRatio: number;
  centroidX: number;
  centroidY: number;
  touchesImageBoundary: boolean;
  nearestProtectedComponentDistance: number;
};

export type RemovedNoiseComponent = {
  component: ResidualNoiseComponentMetrics;
  reason: string;
};

export type ResidualNoiseCleanupDiagnostics = {
  width: number;
  height: number;
  totalForegroundPixels: number;
  totalComponentCount: number;
  protectedComponentCount: number;
  removedComponentCount: number;
  removedPixelCount: number;
  components: ResidualNoiseComponentMetrics[];
  removedComponents: RemovedNoiseComponent[];
};

export type ResidualNoiseCleanupResult = {
  image: RasterPixels;
  changed: boolean;
  removedComponentCount: number;
  removedPixelCount: number;
  diagnostics: ResidualNoiseCleanupDiagnostics;
};

type Component = Omit<
  ResidualNoiseComponentMetrics,
  "foregroundAreaRatio" | "nearestProtectedComponentDistance"
> & { pixels: number[] };

const unchanged = (
  input: RasterPixels,
  components: ResidualNoiseComponentMetrics[] = [],
  foreground = 0,
): ResidualNoiseCleanupResult => ({
  image: {
    data: new Uint8ClampedArray(input.data),
    width: input.width,
    height: input.height,
  },
  changed: false,
  removedComponentCount: 0,
  removedPixelCount: 0,
  diagnostics: {
    width: input.width,
    height: input.height,
    totalForegroundPixels: foreground,
    totalComponentCount: components.length,
    protectedComponentCount: components.length,
    removedComponentCount: 0,
    removedPixelCount: 0,
    components,
    removedComponents: [],
  },
});

function labelComponents(
  input: RasterPixels,
  threshold: number,
): { components: Component[]; foreground: number } {
  const { data, width, height } = input;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const found: Component[] = [];
  let foreground = 0;
  for (let start = 0; start < width * height; start++) {
    if (visited[start] || data[start * 4 + 3] <= threshold) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const pixels: number[] = [];
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let sumX = 0;
    let sumY = 0;
    while (head < tail) {
      const index = queue[head++];
      pixels.push(index);
      foreground++;
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      sumX += x;
      sumY += y;
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          if (!offsetX && !offsetY) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height)
            continue;
          const next = nextY * width + nextX;
          if (visited[next] || data[next * 4 + 3] <= threshold) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    found.push({
      id: found.length + 1,
      pixels,
      pixelCount: pixels.length,
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      areaRatio: pixels.length / (width * height),
      centroidX: sumX / pixels.length,
      centroidY: sumY / pixels.length,
      touchesImageBoundary:
        minX === 0 || minY === 0 || maxX === width - 1 || maxY === height - 1,
    });
  }
  return { components: found, foreground };
}

const distance = (a: Component, b: Component) => {
  const dx = Math.max(0, b.minX - a.maxX, a.minX - b.maxX);
  const dy = Math.max(0, b.minY - a.maxY, a.minY - b.maxY);
  return Math.hypot(dx, dy);
};

export function cleanupResidualNoise(
  input: RasterPixels,
  overrides: Partial<ResidualNoiseCleanupConfig> = {},
): ResidualNoiseCleanupResult {
  try {
    const config = { ...RESIDUAL_NOISE_CLEANUP_CONFIG, ...overrides };
    if (
      !config.enabled ||
      input.width <= 0 ||
      input.height <= 0 ||
      input.data.length !== input.width * input.height * 4
    )
      return unchanged(input);
    const labelled = labelComponents(input, config.alphaForegroundThreshold);
    if (labelled.components.length <= 1) return unchanged(input, [], labelled.foreground);
    const sorted = [...labelled.components].sort(
      (a, b) => b.pixelCount - a.pixelCount || a.id - b.id,
    );
    const protectedSet = new Set(
      sorted
        .filter(
          (component, index) =>
            index < config.protectedLargestComponentCount ||
            component.pixelCount / labelled.foreground >=
              config.meaningfulForegroundAreaRatio ||
            component.width > config.maxNoiseWidth ||
            component.height > config.maxNoiseHeight,
        )
        .map((component) => component.id),
    );
    const protectedComponents = labelled.components.filter((component) =>
      protectedSet.has(component.id),
    );
    if (!protectedComponents.length) return unchanged(input, [], labelled.foreground);

    const metrics = labelled.components.map((component) => {
      const nearest = protectedSet.has(component.id)
        ? 0
        : Math.min(...protectedComponents.map((major) => distance(component, major)));
      return {
        ...component,
        foregroundAreaRatio: component.pixelCount / labelled.foreground,
        nearestProtectedComponentDistance: nearest,
      };
    });
    const repeatedSmallComponents = metrics.filter(
      (component) =>
        component.pixelCount <= config.maxAbsoluteNoisePixels &&
        metrics.filter(
          (peer) =>
            peer.id !== component.id &&
            peer.width === component.width &&
            peer.height === component.height &&
            (Math.abs(peer.centroidX - component.centroidX) <=
              config.protectNearbyComponentDistance ||
              Math.abs(peer.centroidY - component.centroidY) <=
                config.protectNearbyComponentDistance),
        ).length > 0,
    );
    const repeatedSet = new Set(repeatedSmallComponents.map(({ id }) => id));
    const removedComponents: RemovedNoiseComponent[] = [];
    const output = new Uint8ClampedArray(input.data);
    for (const component of metrics) {
      if (
        protectedSet.has(component.id) ||
        repeatedSet.has(component.id) ||
        component.pixelCount > config.maxAbsoluteNoisePixels ||
        component.areaRatio > config.maxRelativeComponentArea ||
        component.foregroundAreaRatio > config.maxRelativeForegroundArea ||
        component.width > config.maxNoiseWidth ||
        component.height > config.maxNoiseHeight ||
        component.nearestProtectedComponentDistance <
          config.minimumIsolationDistance
      )
        continue;
      const source = labelled.components[component.id - 1];
      for (const pixel of source.pixels) output[pixel * 4 + 3] = 0;
      removedComponents.push({
        component,
        reason:
          "Extremely small, low-area component isolated from all protected artwork.",
      });
    }
    const removedPixelCount = removedComponents.reduce(
      (total, item) => total + item.component.pixelCount,
      0,
    );
    return {
      image: { data: output, width: input.width, height: input.height },
      changed: removedComponents.length > 0,
      removedComponentCount: removedComponents.length,
      removedPixelCount,
      diagnostics: {
        width: input.width,
        height: input.height,
        totalForegroundPixels: labelled.foreground,
        totalComponentCount: metrics.length,
        protectedComponentCount: protectedSet.size + repeatedSet.size,
        removedComponentCount: removedComponents.length,
        removedPixelCount,
        components: metrics.map((component) => ({
          id: component.id,
          pixelCount: component.pixelCount,
          minX: component.minX,
          minY: component.minY,
          maxX: component.maxX,
          maxY: component.maxY,
          width: component.width,
          height: component.height,
          areaRatio: component.areaRatio,
          foregroundAreaRatio: component.foregroundAreaRatio,
          centroidX: component.centroidX,
          centroidY: component.centroidY,
          touchesImageBoundary: component.touchesImageBoundary,
          nearestProtectedComponentDistance:
            component.nearestProtectedComponentDistance,
        })),
        removedComponents,
      },
    };
  } catch {
    return unchanged(input);
  }
}
