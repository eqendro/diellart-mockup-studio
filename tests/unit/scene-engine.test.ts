import { describe, expect, it } from "vitest";
import type { PrintableArtwork } from "../../src/features/logo-engine/types/artwork";
import { resolveSceneBackingStore, resolveSceneRenderDpr } from "../../src/features/scene-engine/rendering-quality";
import {
  createSceneArtworkProjection,
  createSceneRegistry,
  getScene,
  lifestyleScenes,
  resolveSceneArtwork,
  resolveSceneSelection,
  sceneCatalogue,
  sceneMessages,
  validateScene,
} from "../../src/features/scene-engine";

const artwork: PrintableArtwork = {
  url: "blob:customer-selected-artwork",
  filename: "customer-mark.png",
  width: 200,
  height: 100,
  aspectRatio: 2,
  veryLight: false,
  canvasWidth: 200,
  canvasHeight: 100,
  foregroundBounds: { x: 0, y: 0, width: 200, height: 100 },
};
const placement = { scale: 0.8, offsetX: 0.1, offsetY: -0.2, rotation: 14 };

describe("scene canvas density", () => {
  it("matches backing-store pixels to a capped device pixel ratio", () => {
    expect(resolveSceneBackingStore(390, 260, 1)).toEqual({ effectiveDpr: 1, width: 390, height: 260 });
    expect(resolveSceneBackingStore(390, 260, 2)).toEqual({ effectiveDpr: 2, width: 780, height: 520 });
    expect(resolveSceneBackingStore(390, 260, 3)).toEqual({ effectiveDpr: 3, width: 1170, height: 780 });
    expect(resolveSceneBackingStore(390, 260, 4)).toEqual({ effectiveDpr: 3, width: 1170, height: 780 });
    expect(resolveSceneRenderDpr(undefined)).toBe(1);
  });
});

describe("scene registry", () => {
  it("registers the three initial data-driven scenes", () => {
    expect(sceneCatalogue.map((scene) => scene.id)).toEqual(["product-view", "main-dish", "dessert"]);
    expect(lifestyleScenes).toHaveLength(2);
  });

  it("validates configuration and rejects invalid registration", () => {
    const valid = getScene("main-dish")!;
    expect(validateScene(valid)).toEqual([]);
    const invalid = { ...valid, canvas: { aspectRatio: 0 } };
    expect(validateScene(invalid)).toContain("Canvas aspect ratio must be positive.");
    expect(() => createSceneRegistry([invalid])).toThrow(/Invalid scene/);
  });

  it("switches to a registered scene and falls back safely", () => {
    expect(resolveSceneSelection("dessert").id).toBe("dessert");
    expect(resolveSceneSelection("not-registered").id).toBe("product-view");
  });

  it("uses the final production assets with a renderer-independent replacement contract", () => {
    expect(lifestyleScenes.map((scene) => scene.asset.path)).toEqual([
      "/scenes/pocket-paper/final/main-dish-steak.jpg",
      "/scenes/pocket-paper/final/dessert-coffee.jpg",
    ]);
    for (const scene of lifestyleScenes) {
      expect(scene.asset.kind).toBe("production");
      expect(scene.canvas.aspectRatio).toBe(3 / 2);
      expect(scene.asset.replacementContract).toMatch(/Replace only asset\.path/);
    }
  });
});

describe("scene artwork transfer", () => {
  it("reuses the exact prepared artwork, including its selected print colour URL", () => {
    const projection = createSceneArtworkProjection(artwork, placement, getScene("dessert")!);
    expect(projection.artwork).toBe(artwork);
    expect(projection.artwork.url).toBe("blob:customer-selected-artwork");
  });

  it("passes the canonical prepared alpha bounds through without adding padding", () => {
    const padded = { ...artwork, canvasWidth: 240, canvasHeight: 140, foregroundBounds: { x: 20, y: 20, width: 200, height: 100 } };
    const projection = resolveSceneArtwork(padded, placement, getScene("main-dish")!, 900, 600)!;
    expect(projection.alphaBounds).toEqual(padded.foregroundBounds);
    expect(projection.visiblePhysicalBounds.centerX).toBeCloseTo(0.6);
    expect(projection.visiblePhysicalBounds.centerY).toBeCloseTo(0.3);
  });

  it("propagates master scale, position, and rotation without scene-specific shrinking", () => {
    const scene = getScene("main-dish")!;
    const mapped = resolveSceneArtwork(artwork, placement, scene, 900, 600)!;
    const larger = resolveSceneArtwork(artwork, { ...placement, scale: 1 }, scene, 900, 600)!;
    const rotated = resolveSceneArtwork(artwork, { ...placement, rotation: 24 }, scene, 900, 600)!;
    expect(larger.physicalBounds.widthRatio / mapped.physicalBounds.widthRatio).toBeCloseTo(1 / 0.8);
    expect(rotated.rotation - mapped.rotation).toBe(10);
    expect(mapped.offsetX).toBe(placement.offsetX);
    expect(mapped.offsetY).toBe(placement.offsetY);
  });

  it("keeps identical normalized physical placement across every photographed paper", () => {
    const centred = { scale: 0.88, offsetX: 0, offsetY: 0, rotation: 0 };
    const usages = sceneCatalogue.map((scene) => {
      const width = 900;
      const height = width / scene.canvas.aspectRatio;
      return resolveSceneArtwork(artwork, centred, scene, width, height)!.physicalBounds;
    });
    expect(usages.every((usage) => JSON.stringify(usage) === JSON.stringify(usages[0]))).toBe(true);
    expect(resolveSceneArtwork(artwork, centred, getScene("dessert")!, 0, 600)).toBeNull();
  });

  it.each([
    ["tall", 0.4], ["wide", 4], ["square", 1], ["text-heavy", 2.8], ["thin-lines", 1.6],
  ])("keeps %s artwork invariant across scenes", (_name, aspectRatio) => {
    const candidate = { ...artwork, aspectRatio, width: 400 * aspectRatio, height: 400, canvasWidth: 400 * aspectRatio, canvasHeight: 400, foregroundBounds: { x: 0, y: 0, width: 400 * aspectRatio, height: 400 } };
    const bounds = sceneCatalogue.map((scene) => resolveSceneArtwork(candidate, placement, scene, 900, 600)!.physicalBounds);
    for (const value of bounds.slice(1)) {
      expect(value.centerX).toBeCloseTo(bounds[0].centerX, 8);
      expect(value.centerY).toBeCloseTo(bounds[0].centerY, 8);
      expect(value.widthRatio).toBeCloseTo(bounds[0].widthRatio, 8);
      expect(value.heightRatio).toBeCloseTo(bounds[0].heightRatio, 8);
    }
  });

  it("changes only output pixels, not physical placement, across responsive sizes", () => {
    const desktop = resolveSceneArtwork(artwork, placement, getScene("main-dish")!, 1200, 800)!;
    const mobile = resolveSceneArtwork(artwork, placement, getScene("main-dish")!, 390, 260)!;
    expect(mobile.physicalBounds).toEqual(desktop.physicalBounds);
    expect(mobile.matrix3d).not.toBe(desktop.matrix3d);
  });

  it("reports mild local perspective for Steak", () => {
    const mapped = resolveSceneArtwork(artwork, { ...placement, rotation: 0 }, getScene("main-dish")!, 1536, 1024)!;
    expect(mapped.distortion.topToBottomRatio).toBeGreaterThan(0.85);
    expect(mapped.distortion.topToBottomRatio).toBeLessThan(1.15);
    expect(mapped.distortion.horizontalDivergenceDeg).toBeLessThan(8);
  });

  it("keeps paper geometry independent from conservative print material tuning", () => {
    expect(getScene("main-dish")!.paperSurface).toEqual({
      topLeft: { x: 0.076, y: 0.6 }, topRight: { x: 0.319, y: 0.538 },
      bottomRight: { x: 0.336, y: 0.845 }, bottomLeft: { x: 0.113, y: 0.92 },
    });
    expect(getScene("dessert")!.paperSurface).toEqual({
      topLeft: { x: 0.165, y: 0.532 }, topRight: { x: 0.357, y: 0.51 },
      bottomRight: { x: 0.499, y: 0.883 }, bottomLeft: { x: 0.182, y: 0.988 },
    });
    for (const scene of lifestyleScenes) {
      expect(scene.printMaterial.edgeSoftnessPxAt1024).toBeLessThanOrEqual(0.12);
      expect(scene.printMaterial.inkOpacity).toBeGreaterThanOrEqual(0.98);
    }
  });
});

describe("scene presentation contract", () => {
  it("centralises required English and Albanian labels", () => {
    expect(sceneMessages.en).toMatchObject({ productView: "Product", mainDish: "Main Dish", dessert: "Dessert & Coffee" });
    expect(sceneMessages.sq).toMatchObject({ productView: "Produkti", mainDish: "Pjata Kryesore", dessert: "Ëmbëlsirë & Kafe" });
  });

  it("contains no customer-specific artwork in scene configuration", () => {
    const serialised = JSON.stringify(sceneCatalogue).toLowerCase();
    expect(serialised).not.toContain("riviera");
    expect(serialised).not.toContain("customer logo");
    expect(serialised).not.toContain("diellart logo");
    expect(serialised).not.toContain("xh'aura");
    expect(serialised).not.toContain("vodafone");
  });

  it("provides mobile and desktop framing for every scene", () => {
    for (const scene of sceneCatalogue) {
      expect(scene.framing.desktopObjectPosition).toBeTruthy();
      expect(scene.framing.mobileObjectPosition).toBeTruthy();
    }
  });
});
