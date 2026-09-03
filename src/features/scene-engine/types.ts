export type SceneId = string;
export type SceneCategory = "product" | "lifestyle";
export type NormalisedPoint = { x: number; y: number };
export type SurfaceQuad = {
  topLeft: NormalisedPoint;
  topRight: NormalisedPoint;
  bottomRight: NormalisedPoint;
  bottomLeft: NormalisedPoint;
};

export type SceneDefinition = {
  id: SceneId;
  labelKey: string;
  category: SceneCategory;
  asset: {
    path: string;
    kind: "production" | "placeholder";
    replacementContract: string;
  };
  canvas: { aspectRatio: number };
  /** A photographed surface measured from the paper, never from customer artwork. */
  paperSurface: SurfaceQuad;
  /** Local safe-area quads avoid extrapolating strong outer-edge convergence. */
  surfaceCoordinates: "paper" | "safe-area";
  safeMargins: { horizontal: number; vertical: number };
  lighting: {
    opacity: number;
    blendMode: "normal" | "multiply" | "darken";
    brightness: number;
    contrast: number;
    saturation: number;
    blurPx: number;
  };
  paperTexture: number;
  printMaterial: {
    inkOpacity: number;
    density: number;
    luminanceInfluence: number;
    textureInfluence: number;
    edgeSoftnessPxAt1024: number;
  };
  framing: {
    desktopObjectPosition: string;
    mobileObjectPosition: string;
  };
  fallbackLabelKey: string;
};

export type ProjectedSceneArtwork = {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  matrix3d: string;
  physicalBounds: { centerX: number; centerY: number; widthRatio: number; heightRatio: number };
  visiblePhysicalBounds: { centerX: number; centerY: number; widthRatio: number; heightRatio: number };
  alphaBounds: { x: number; y: number; width: number; height: number };
  projectedAlphaQuad: SurfaceQuad;
  projectedCanvasQuad: SurfaceQuad;
  inverseProjection: number[];
  distortion: ProjectionDistortion;
};

export type ProjectionDistortion = {
  topToBottomRatio: number;
  leftToRightRatio: number;
  aspectRatioScale: number;
  horizontalDivergenceDeg: number;
  verticalDivergenceDeg: number;
};
