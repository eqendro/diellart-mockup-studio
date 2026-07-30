export type NormalisedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SafeMargins = {
  horizontal: number;
  vertical: number;
};

export type RenderingProfile = {
  material: "paper";
  finish: "matte" | "coated";
  blendMode: "normal" | "multiply" | "darken";
  opacity: number;
  contrast: number;
  saturation: number;
  blurPx: number;
  lightArtworkOpacity: number;
  lightArtworkBlendMode: "normal" | "multiply" | "darken";
  lightArtworkContrast: number;
  inkSpreadPx: number;
  textureInfluence: number;
};

export type LogoFitProfile = {
  wideWidthUsage: number;
  tallHeightUsage: number;
  squareUsage: number;
  squareAspectRange: readonly [number, number];
};

export type ProductMockup = {
  id: string;
  name: string;
  imagePath: string;
  intrinsicSize?: {
    width: number;
    height: number;
  };
  productBounds: NormalisedRect;
  surface: NormalisedRect & {
    safeMargins: SafeMargins;
  };
  defaultLogoPlacement: {
    scale: number;
    offsetX: number;
    offsetY: number;
  };
  renderingProfile: RenderingProfile;
  fitProfile: LogoFitProfile;
};

export type ProductTemplate = {
  id: string;
  name: string;
  physicalSize: {
    widthMm: number;
    heightMm: number;
  };
  mockups: ProductMockup[];
  rendering?: {
    notes?: string;
  };
};
