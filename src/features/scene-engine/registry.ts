import type { SceneDefinition, SceneId } from "@/features/scene-engine/types";

const replacementContract =
  "Replace only asset.path with an image of the same aspect ratio, then recalibrate paperSurface from the four physical paper corners if it moves.";

const sharedPaperLighting = {
  opacity: 0.88,
  blendMode: "multiply",
  brightness: 0.98,
  contrast: 0.95,
  saturation: 0.94,
  blurPx: 0.06,
} as const;

const sharedPrintMaterial = {
  inkOpacity: 0.98,
  density: 0.965,
  luminanceInfluence: 0.055,
  textureInfluence: 0.08,
  edgeSoftnessPxAt1024: 0.1,
} as const;

const scenes = [
  {
    id: "product-view",
    labelKey: "productView",
    category: "product",
    asset: { path: "/mockups/pocket-paper/product-view.png", kind: "production", replacementContract },
    canvas: { aspectRatio: 2 / 3 },
    paperSurface: {
      topLeft: { x: 0.16, y: 0.3704 }, topRight: { x: 0.792, y: 0.3704 },
      bottomRight: { x: 0.792, y: 0.928 }, bottomLeft: { x: 0.16, y: 0.928 },
    },
    surfaceCoordinates: "paper",
    safeMargins: { horizontal: 0.08, vertical: 0.08 },
    lighting: { ...sharedPaperLighting, opacity: 0.92, brightness: 1, contrast: 0.96, blurPx: 0.15 },
    paperTexture: 0.05,
    printMaterial: { ...sharedPrintMaterial, luminanceInfluence: 0.035, textureInfluence: 0.04 },
    framing: { desktopObjectPosition: "50% 50%", mobileObjectPosition: "50% 50%" },
    fallbackLabelKey: "previewUnavailable",
  },
  {
    id: "main-dish",
    labelKey: "mainDish",
    category: "lifestyle",
    asset: { path: "/scenes/pocket-paper/final/main-dish-steak.jpg", kind: "production", replacementContract },
    canvas: { aspectRatio: 3 / 2 },
    // Local safe print plane: measured around the useful lower-face branding
    // region, excluding the fold, cutlery pocket, and converging outer edges.
paperSurface: {
  topLeft:     { x: 0.076, y: 0.600 },
  topRight:    { x: 0.319, y: 0.538 },

  bottomRight: { x: 0.336, y: 0.845 },
  bottomLeft:  { x: 0.113, y: 0.920 },
},
    surfaceCoordinates: "safe-area",
    safeMargins: { horizontal: 0.08, vertical: 0.08 },
    lighting: { ...sharedPaperLighting, brightness: 0.96 },
    paperTexture: 0.14,
    printMaterial: { ...sharedPrintMaterial, luminanceInfluence: 0.06, textureInfluence: 0.09, edgeSoftnessPxAt1024: 0.12 },
    framing: { desktopObjectPosition: "50% 50%", mobileObjectPosition: "42% 50%" },
    fallbackLabelKey: "previewUnavailable",
  },
  {
    id: "dessert",
    labelKey: "dessert",
    category: "lifestyle",
    asset: { path: "/scenes/pocket-paper/final/dessert-coffee.jpg", kind: "production", replacementContract },
    canvas: { aspectRatio: 3 / 2 },
    paperSurface: {
      topLeft: { x: 0.165, y: 0.532 }, topRight: { x: 0.357, y: 0.51 },
      bottomRight: { x: 0.499, y: 0.883 }, bottomLeft: { x: 0.182, y: 0.988 },
    },
    surfaceCoordinates: "paper",
    safeMargins: { horizontal: 0.08, vertical: 0.08 },
    lighting: { ...sharedPaperLighting, brightness: 1 },
    paperTexture: 0.14,
    printMaterial: { ...sharedPrintMaterial, luminanceInfluence: 0.05, textureInfluence: 0.08 },
    framing: { desktopObjectPosition: "50% 50%", mobileObjectPosition: "45% 50%" },
    fallbackLabelKey: "previewUnavailable",
  },
] as const satisfies readonly SceneDefinition[];

export function validateScene(scene: SceneDefinition): string[] {
  const errors: string[] = [];
  if (!scene.id || !scene.asset.path) errors.push("Scene id and asset path are required.");
  if (!(scene.canvas.aspectRatio > 0)) errors.push("Canvas aspect ratio must be positive.");
  const points = Object.values(scene.paperSurface);
  if (points.some((point) => point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) errors.push("Paper surface corners must remain inside the normalised canvas.");
  if (scene.safeMargins.horizontal < 0 || scene.safeMargins.horizontal >= 0.5 || scene.safeMargins.vertical < 0 || scene.safeMargins.vertical >= 0.5) errors.push("Safe margins must be between zero and one half.");
  if (scene.lighting.opacity < 0 || scene.lighting.opacity > 1) errors.push("Opacity must be between zero and one.");
  if (scene.paperTexture < 0 || scene.paperTexture > 1) errors.push("Paper texture must be between zero and one.");
  const material = scene.printMaterial;
  if ([material.inkOpacity, material.density, material.luminanceInfluence, material.textureInfluence].some((value) => value < 0 || value > 1)) errors.push("Print material values must be between zero and one.");
  if (material.edgeSoftnessPxAt1024 < 0 || material.edgeSoftnessPxAt1024 > 0.3) errors.push("Print edge softness must remain sub-pixel and conservative.");
  return errors;
}

function createSceneRegistry(definitions: readonly SceneDefinition[]) {
  const registry = new Map<SceneId, SceneDefinition>();
  for (const scene of definitions) {
    const errors = validateScene(scene);
    if (errors.length) throw new Error(`Invalid scene "${scene.id}": ${errors.join(" ")}`);
    if (registry.has(scene.id)) throw new Error(`Duplicate scene id "${scene.id}".`);
    registry.set(scene.id, scene);
  }
  return registry;
}

export const sceneRegistry = createSceneRegistry(scenes);
export const sceneCatalogue = [...sceneRegistry.values()];
export const lifestyleScenes = sceneCatalogue.filter((scene) => scene.category === "lifestyle");
export function getScene(id: SceneId): SceneDefinition | null { return sceneRegistry.get(id) ?? null; }
export function resolveSceneSelection(id: string, fallback: SceneId = "product-view"): SceneDefinition { return sceneRegistry.get(id) ?? sceneRegistry.get(fallback)!; }
export { createSceneRegistry };
