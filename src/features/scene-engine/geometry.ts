import { pocketPaperProductView } from "@/config/products/pocket-paper";
import type { PrintableArtwork } from "@/features/logo-engine/types/artwork";
import type { ArtworkPlacement } from "@/features/mockup-engine/placement";
import { calculateLogoFit } from "@/features/mockup-engine/utils/calculate-logo-fit";
import { resolveArtworkGeometry } from "@/features/mockup-engine/utils/resolve-artwork-geometry";
import type { NormalisedPoint, ProjectedSceneArtwork, ProjectionDistortion, SceneDefinition, SurfaceQuad } from "@/features/scene-engine/types";

type Matrix = [number, number, number, number, number, number, number, number, number];

const masterSurfaceAspectRatio =
  (pocketPaperProductView.productBounds.width * pocketPaperProductView.surface.width * pocketPaperProductView.intrinsicSize.width) /
  (pocketPaperProductView.productBounds.height * pocketPaperProductView.surface.height * pocketPaperProductView.intrinsicSize.height);

function solveHomography(source: NormalisedPoint[], target: NormalisedPoint[]): Matrix {
  const rows = source.flatMap((point, index) => {
    const targetPoint = target[index];
    return [
      [point.x, point.y, 1, 0, 0, 0, -targetPoint.x * point.x, -targetPoint.x * point.y, targetPoint.x],
      [0, 0, 0, point.x, point.y, 1, -targetPoint.y * point.x, -targetPoint.y * point.y, targetPoint.y],
    ];
  });
  for (let column = 0; column < 8; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 8; row += 1) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    if (Math.abs(divisor) < 1e-10) throw new Error("Degenerate paper surface calibration.");
    for (let cell = column; cell < 9; cell += 1) rows[column][cell] /= divisor;
    for (let row = 0; row < 8; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let cell = column; cell < 9; cell += 1) rows[row][cell] -= factor * rows[column][cell];
    }
  }
  return [...rows.map((row) => row[8]), 1] as Matrix;
}

export function projectPoint(matrix: Matrix, point: NormalisedPoint): NormalisedPoint {
  const denominator = matrix[6] * point.x + matrix[7] * point.y + matrix[8];
  return {
    x: (matrix[0] * point.x + matrix[1] * point.y + matrix[2]) / denominator,
    y: (matrix[3] * point.x + matrix[4] * point.y + matrix[5]) / denominator,
  };
}

const distance = (a: NormalisedPoint, b: NormalisedPoint) => Math.hypot(b.x - a.x, b.y - a.y);
const angle = (a: NormalisedPoint, b: NormalisedPoint) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
const angleDifference = (a: number, b: number) => Math.abs(((a - b + 180) % 360) - 180);

export function measureProjectionDistortion(quad: SurfaceQuad, sourceAspectRatio: number): ProjectionDistortion {
  const top = distance(quad.topLeft, quad.topRight);
  const bottom = distance(quad.bottomLeft, quad.bottomRight);
  const left = distance(quad.topLeft, quad.bottomLeft);
  const right = distance(quad.topRight, quad.bottomRight);
  const averageWidth = (top + bottom) / 2;
  const averageHeight = (left + right) / 2;
  return {
    topToBottomRatio: top / bottom,
    leftToRightRatio: left / right,
    aspectRatioScale: (averageWidth / averageHeight) / sourceAspectRatio,
    horizontalDivergenceDeg: angleDifference(angle(quad.topLeft, quad.topRight), angle(quad.bottomLeft, quad.bottomRight)),
    verticalDivergenceDeg: angleDifference(angle(quad.topLeft, quad.bottomLeft), angle(quad.topRight, quad.bottomRight)),
  };
}

export function resolveSceneArtwork(
  artwork: PrintableArtwork, placement: ArtworkPlacement, scene: SceneDefinition,
  stageWidth: number, stageHeight: number,
): ProjectedSceneArtwork | null {
  if (stageWidth <= 0 || stageHeight <= 0) return null;
  const fit = calculateLogoFit({
    mockupWidth: masterSurfaceAspectRatio, mockupHeight: 1,
    productBounds: { x: 0, y: 0, width: 1, height: 1 },
    surface: { x: 0, y: 0, width: 1, height: 1 },
    safeMargins: scene.safeMargins,
    logoAspectRatio: artwork.aspectRatio, scaleMultiplier: placement.scale,
    offsetX: placement.offsetX, offsetY: placement.offsetY,
    fitProfile: pocketPaperProductView.fitProfile,
  });
  const rawPhysical = resolveArtworkGeometry(fit, artwork, placement);
  const physical = {
    ...rawPhysical,
    left: rawPhysical.left / masterSurfaceAspectRatio,
    width: rawPhysical.width / masterSurfaceAspectRatio,
  };
  const center = { x: physical.left + physical.width / 2, y: physical.top + physical.height / 2 };
  const radians = placement.rotation * Math.PI / 180;
  const rotate = (x: number, y: number) => ({
    x: center.x + x * Math.cos(radians) - y * Math.sin(radians),
    y: center.y + x * Math.sin(radians) + y * Math.cos(radians),
  });
  const physicalCorners = [
    rotate(-physical.width / 2, -physical.height / 2), rotate(physical.width / 2, -physical.height / 2),
    rotate(physical.width / 2, physical.height / 2), rotate(-physical.width / 2, physical.height / 2),
  ];
  const surface = scene.paperSurface;
  const paperMatrix = solveHomography(
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    [surface.topLeft, surface.topRight, surface.bottomRight, surface.bottomLeft],
  );
  const projectPhysicalPoint = (point: NormalisedPoint) => {
    const mappedInput = scene.surfaceCoordinates === "safe-area" ? {
      x: (point.x - scene.safeMargins.horizontal) / (1 - scene.safeMargins.horizontal * 2),
      y: (point.y - scene.safeMargins.vertical) / (1 - scene.safeMargins.vertical * 2),
    } : point;
    const mapped = projectPoint(paperMatrix, mappedInput);
    return { x: mapped.x * stageWidth, y: mapped.y * stageHeight };
  };
  const projected = physicalCorners.map(projectPhysicalPoint);
  const imageMatrix = solveHomography(
    [{ x: 0, y: 0 }, { x: artwork.canvasWidth, y: 0 }, { x: artwork.canvasWidth, y: artwork.canvasHeight }, { x: 0, y: artwork.canvasHeight }],
    projected,
  );
  const [a, b, c, d, e, f, g, h, i] = imageMatrix;
  const foreground = artwork.foregroundBounds;
  const normalizedFit = { x: fit.x / masterSurfaceAspectRatio, y: fit.y, width: fit.width / masterSurfaceAspectRatio, height: fit.height };
  const safeWidth = 1 - scene.safeMargins.horizontal * 2;
  const safeHeight = 1 - scene.safeMargins.vertical * 2;
  const visiblePhysicalBounds = {
    centerX: (normalizedFit.x + normalizedFit.width / 2 - scene.safeMargins.horizontal) / safeWidth,
    centerY: (normalizedFit.y + normalizedFit.height / 2 - scene.safeMargins.vertical) / safeHeight,
    widthRatio: normalizedFit.width / safeWidth,
    heightRatio: normalizedFit.height / safeHeight,
  };
  const alphaPhysicalCorners = [
    { x: normalizedFit.x, y: normalizedFit.y }, { x: normalizedFit.x + normalizedFit.width, y: normalizedFit.y },
    { x: normalizedFit.x + normalizedFit.width, y: normalizedFit.y + normalizedFit.height }, { x: normalizedFit.x, y: normalizedFit.y + normalizedFit.height },
  ].map((point) => rotate(point.x - center.x, point.y - center.y));
  const alphaProjected = alphaPhysicalCorners.map(projectPhysicalPoint);
  const projectedAlphaQuad: SurfaceQuad = {
    topLeft: alphaProjected[0], topRight: alphaProjected[1],
    bottomRight: alphaProjected[2], bottomLeft: alphaProjected[3],
  };
  return {
    left: 0, top: 0, width: artwork.canvasWidth, height: artwork.canvasHeight,
    rotation: placement.rotation, scale: placement.scale, offsetX: placement.offsetX, offsetY: placement.offsetY,
    matrix3d: `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,${i})`,
    physicalBounds: { centerX: center.x, centerY: center.y, widthRatio: physical.width, heightRatio: physical.height },
    visiblePhysicalBounds,
    alphaBounds: { ...foreground },
    projectedAlphaQuad,
    distortion: measureProjectionDistortion(projectedAlphaQuad, artwork.aspectRatio),
  };
}

/** Backwards-compatible name for callers while all scenes now use projective mapping. */
export const resolveAffineSceneArtwork = resolveSceneArtwork;

export function createSceneArtworkProjection(artwork: PrintableArtwork, placement: ArtworkPlacement, scene: SceneDefinition) {
  return { artwork, placement, sceneId: scene.id };
}
