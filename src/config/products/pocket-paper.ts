import type { ProductTemplate } from "@/types/product-template";

export const SHOW_MOCKUP_DEBUG_OVERLAY = false;

export const pocketPaperTemplate = {
  id: "pocket-paper",
  name: "Pocket Paper",
  physicalSize: {
    widthMm: 100,
    heightMm: 200,
  },
  mockups: [
    {
      id: "product-view",
      name: "Product View",
      imagePath: "/mockups/pocket-paper/product-view.png",
      intrinsicSize: {
        width: 1024,
        height: 1536,
      },
      // Calibrated against the visible paper edges inside the full image canvas.
      productBounds: {
        x: 0.16,
        y: 0.092,
        width: 0.632,
        height: 0.836,
      },
      surface: {
        x: 0,
        // The visible fold is approximately one third down the product bounds.
        y: 0.333,
        width: 1,
        height: 0.667,
        safeMargins: {
          horizontal: 0.08,
          vertical: 0.08,
        },
      },
      defaultLogoPlacement: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      },
      fitProfile: {
        wideWidthUsage: 0.88,
        tallHeightUsage: 0.82,
        squareUsage: 0.84,
        squareAspectRange: [0.8, 1.25],
      },
      renderingProfile: {
        material: "paper",
        finish: "matte",
        blendMode: "multiply",
        opacity: 0.92,
        contrast: 0.96,
        saturation: 0.96,
        blurPx: 0.15,
        lightArtworkOpacity: 0.98,
        lightArtworkBlendMode: "normal",
        lightArtworkContrast: 1.08,
        inkSpreadPx: 0.08,
        textureInfluence: 0.05,
      },
    },
  ],
  rendering: {
    notes: "Browser-side flat composition; production tolerances are not yet confirmed.",
  },
} satisfies ProductTemplate;

export const pocketPaperProductView = pocketPaperTemplate.mockups[0];
