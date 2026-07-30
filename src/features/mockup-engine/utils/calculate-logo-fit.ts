import type { LogoFitProfile, NormalisedRect, SafeMargins } from "@/types/product-template";

export type LogoFitInput = {
  mockupWidth: number;
  mockupHeight: number;
  productBounds: NormalisedRect;
  surface: NormalisedRect;
  safeMargins: SafeMargins;
  logoAspectRatio: number | null;
  scaleMultiplier?: number;
  offsetX?: number;
  offsetY?: number;
  fitProfile?: LogoFitProfile;
};

export type LogoFit = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const emptyFit: LogoFit = { x: 0, y: 0, width: 0, height: 0 };

const isPositiveFinite = (value: number | null): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export function calculateLogoFit({
  mockupWidth,
  mockupHeight,
  productBounds,
  surface,
  safeMargins,
  logoAspectRatio,
  scaleMultiplier = 1,
  offsetX = 0,
  offsetY = 0,
  fitProfile,
}: LogoFitInput): LogoFit {
  if (
    !isPositiveFinite(mockupWidth) ||
    !isPositiveFinite(mockupHeight) ||
    !isPositiveFinite(productBounds.width) ||
    !isPositiveFinite(productBounds.height) ||
    !isPositiveFinite(surface.width) ||
    !isPositiveFinite(surface.height) ||
    !isPositiveFinite(logoAspectRatio)
  ) {
    return emptyFit;
  }

  const productX = productBounds.x * mockupWidth;
  const productY = productBounds.y * mockupHeight;
  const productWidth = productBounds.width * mockupWidth;
  const productHeight = productBounds.height * mockupHeight;
  const surfaceX = productX + surface.x * productWidth;
  const surfaceY = productY + surface.y * productHeight;
  const surfaceWidth = surface.width * productWidth;
  const surfaceHeight = surface.height * productHeight;
  const safeWidth = surfaceWidth * Math.max(0, 1 - safeMargins.horizontal * 2);
  const safeHeight = surfaceHeight * Math.max(0, 1 - safeMargins.vertical * 2);

  if (!isPositiveFinite(safeWidth) || !isPositiveFinite(safeHeight)) {
    return emptyFit;
  }

  const safeX = surfaceX + surfaceWidth * Math.max(0, safeMargins.horizontal);
  const safeY = surfaceY + surfaceHeight * Math.max(0, safeMargins.vertical);
  const isSquare = fitProfile
    ? logoAspectRatio >= fitProfile.squareAspectRange[0] &&
      logoAspectRatio <= fitProfile.squareAspectRange[1]
    : false;
  const usage = fitProfile
    ? isSquare
      ? fitProfile.squareUsage
      : logoAspectRatio > 1
        ? fitProfile.wideWidthUsage
        : fitProfile.tallHeightUsage
    : 1;
  const availableWidth = safeWidth * (logoAspectRatio >= 1 || isSquare ? usage : 1);
  const availableHeight = safeHeight * (logoAspectRatio < 1 || isSquare ? usage : 1);
  const containedWidth = Math.min(availableWidth, availableHeight * logoAspectRatio);
  const containedHeight = containedWidth / logoAspectRatio;
  const safeScale = Math.min(1, Math.max(0, scaleMultiplier));
  const width = containedWidth * safeScale;
  const height = containedHeight * safeScale;
  const remainingX = (safeWidth - width) / 2;
  const remainingY = (safeHeight - height) / 2;
  const clampedOffsetX = Math.max(-remainingX, Math.min(remainingX, offsetX * safeWidth));
  const clampedOffsetY = Math.max(-remainingY, Math.min(remainingY, offsetY * safeHeight));

  return {
    x: safeX + remainingX + clampedOffsetX,
    y: safeY + remainingY + clampedOffsetY,
    width,
    height,
  };
}
