import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getScene, resolveSceneArtwork } from "../../src/features/scene-engine";

const logo = path.resolve(process.cwd(), "tests", "assets", "logos", "EC.png");
const calibrationArtwork = path.resolve(process.cwd(), "tests", "assets", "logos", "scene-calibration.svg");
const xhAuraArtwork = path.resolve(process.cwd(), "tests", "assets", "logos", "Xh'Aura.jpeg");

async function captureSceneQa(page: import("@playwright/test").Page, prefix: string) {
  await mkdir("test-results/scene-correction", { recursive: true });
  const productPath = `test-results/scene-correction/${prefix}-product-view.png`;
  await page.locator(".proof-stage").screenshot({ path: productPath });
  await page.locator(".mockup-logo").screenshot({ path: `test-results/scene-correction/${prefix}-product-closeup.png` });
  const records: Record<string, unknown>[] = [];
  const fullPaths = [productPath];
  for (const [button, id, filename] of [
    ["Main Dish", "main-dish", "steak"], ["Dessert & Coffee", "dessert", "dessert"],
  ] as const) {
    await page.getByRole("button", { name: button }).click();
    const scene = page.locator(`[data-scene-id="${id}"]`);
    const image = scene.locator(".scene-artwork");
    await expect(image).toBeVisible();
    const scenePath = `test-results/scene-correction/${prefix}-${filename}.png`;
    await page.locator(".scene-preview-frame").screenshot({ path: scenePath });
    await image.screenshot({ path: `test-results/scene-correction/${prefix}-${filename}-closeup.png` });
    fullPaths.push(scenePath);
    records.push(await scene.evaluate((element) => ({
      scene: element.getAttribute("data-scene-id"),
      preparedRaster: { width: (element.querySelector(".scene-artwork") as HTMLImageElement).naturalWidth, height: (element.querySelector(".scene-artwork") as HTMLImageElement).naturalHeight },
      alphaBounds: Object.fromEntries(["left", "top", "width", "height"].map((key) => [key, element.querySelector(".scene-artwork")?.getAttribute(`data-alpha-${key}`)])),
      physicalBounds: JSON.parse(element.getAttribute("data-physical-bounds") ?? "null"),
      visiblePhysicalBounds: JSON.parse(element.getAttribute("data-visible-physical-bounds") ?? "null"),
      printableQuadrilateral: JSON.parse(element.getAttribute("data-printable-quad") ?? "null"),
      surfaceCoordinates: element.getAttribute("data-surface-coordinates"),
      distortion: JSON.parse(element.getAttribute("data-distortion") ?? "null"),
      transformMatrix: element.getAttribute("data-transform-matrix"),
    })));
  }
  await writeFile(`test-results/scene-correction/${prefix}-metrics.json`, JSON.stringify(records, null, 2));
  const panels = await Promise.all(fullPaths.map((file) => sharp(file).resize({ width: 600, height: 650, fit: "contain", background: "#f4f1eb" }).png().toBuffer()));
  const labels = `<svg width="1800" height="50"><style>text{font:700 22px Arial;fill:#25221e}</style><text x="240" y="32">PRODUCT VIEW</text><text x="865" y="32">STEAK</text><text x="1440" y="32">DESSERT</text></svg>`;
  await sharp({ create: { width: 1800, height: 700, channels: 3, background: "#f4f1eb" } })
    .composite([{ input: Buffer.from(labels), top: 0, left: 0 }, ...panels.map((input, index) => ({ input, top: 50, left: index * 600 }))])
    .png().toFile(`test-results/scene-correction/${prefix}-comparison-sheet.png`);
}

test.describe("Scene Engine presentation", () => {
  test("switches registered lifestyle scenes on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(page.locator('[data-scene-id="main-dish"]')).toBeVisible();
    await page.getByRole("button", { name: "Dessert & Coffee" }).click();
    await expect(page.locator('[data-scene-id="dessert"]')).toBeVisible();
    await expect(page.locator('[data-scene-id="main-dish"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Dessert & Coffee" })).toHaveAttribute("aria-pressed", "true");
  });

  test("stacks previews without horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator(".scene-selector")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("shares colour and master placement across lifestyle previews", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Select a logo file").setInputFiles(logo);
    await expect(page.locator(".mockup-logo")).toBeVisible();
    const mainArtwork = page.locator('[data-scene-id="main-dish"] .scene-artwork');
    await expect(mainArtwork).toBeVisible();
    const initialSource = await mainArtwork.getAttribute("src");
    await page.getByRole("button", { name: "Blue" }).click();
    await expect.poll(() => mainArtwork.getAttribute("src")).not.toBe(initialSource);
    const blueSource = await mainArtwork.getAttribute("src");

    await page.getByRole("button", { name: "Make artwork larger" }).click();
    await page.getByRole("button", { name: "Rotate artwork clockwise" }).click();
    await page.getByRole("button", { name: "Move logo right" }).click();
    const master = page.locator(".mockup-stage");
    const scale = await master.getAttribute("data-placement-scale");
    const rotation = await master.getAttribute("data-placement-rotation");
    const offsetX = await master.getAttribute("data-placement-offset-x");
    await expect(mainArtwork).toHaveAttribute("data-placement-scale", scale!);
    await expect(mainArtwork).toHaveAttribute("data-placement-rotation", rotation!);
    await expect(mainArtwork).toHaveAttribute("data-placement-offset-x", offsetX!);
    for (const attribute of ["data-alpha-left", "data-alpha-top", "data-alpha-width", "data-alpha-height"]) {
      await expect(mainArtwork).toHaveAttribute(attribute, await page.locator(".mockup-logo").getAttribute(attribute) ?? "");
    }

    await page.getByRole("button", { name: "Dessert & Coffee" }).click();
    const dessertArtwork = page.locator('[data-scene-id="dessert"] .scene-artwork');
    await expect(dessertArtwork).toHaveAttribute("src", blueSource!);
    await expect(dessertArtwork).toHaveAttribute("data-placement-scale", scale!);
    await expect(dessertArtwork).toHaveAttribute("data-placement-rotation", rotation!);
    await expect(dessertArtwork).toHaveAttribute("data-placement-offset-x", offsetX!);
    for (const attribute of ["data-alpha-left", "data-alpha-top", "data-alpha-width", "data-alpha-height"]) {
      await expect(dessertArtwork).toHaveAttribute(attribute, await page.locator(".mockup-logo").getAttribute(attribute) ?? "");
    }
    await expect(page.locator(".scene-preview-frame").getByRole("button")).toHaveCount(0);
  });

  test("captures deterministic physical-placement visual QA", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.goto("/");
    await page.getByLabel("Select a logo file").setInputFiles(calibrationArtwork);
    await expect(page.locator(".mockup-logo")).toBeVisible();
    await page.locator(".proof-stage").screenshot({ path: "test-results/scene-calibration/product-view.png" });
    await expect(page.locator('[data-scene-id="main-dish"] .scene-artwork')).toBeVisible();
    await page.locator(".scene-preview-frame").screenshot({ path: "test-results/scene-calibration/main-dish-steak.png" });
    await page.getByRole("button", { name: "Dessert & Coffee" }).click();
    await expect(page.locator('[data-scene-id="dessert"] .scene-artwork')).toBeVisible();
    await page.locator(".scene-preview-frame").screenshot({ path: "test-results/scene-calibration/dessert-coffee.png" });
  });

  test("captures corrected synthetic and XhAura lifestyle comparisons", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    for (const [fixture, prefix] of [[calibrationArtwork, "synthetic"], [xhAuraArtwork, "xh-aura"]] as const) {
      await page.goto("/");
      await page.getByLabel("Select a logo file").setInputFiles(fixture);
      await expect(page.locator(".mockup-logo")).toBeVisible();
      await captureSceneQa(page, prefix);
      if (prefix === "xh-aura") {
        await page.getByRole("button", { name: "Main Dish" }).click();
        const stage = page.locator('[data-scene-id="main-dish"] .scene-stage');
        const size = await stage.boundingBox();
        const current = getScene("main-dish")!;
        const previous = {
          ...current,
          paperSurface: {
            topLeft: { x: 0.222, y: 0.657 }, topRight: { x: 0.329, y: 0.671 },
            bottomRight: { x: 0.365, y: 0.888 }, bottomLeft: { x: 0.25, y: 0.91 },
          },
        };
        const before = resolveSceneArtwork({
          url: "qa", filename: "Xh'Aura.jpeg", width: 578, height: 581,
          aspectRatio: 540 / 543, veryLight: false, canvasWidth: 578, canvasHeight: 581,
          foregroundBounds: { x: 19, y: 19, width: 540, height: 543 },
        }, { scale: 0.88, offsetX: 0, offsetY: 0, rotation: 0 }, previous, size!.width, size!.height)!;
        await page.locator('[data-scene-id="main-dish"] .scene-artwork').evaluate((element, matrix) => { element.style.transform = matrix; }, before.matrix3d);
        await page.locator(".scene-preview-frame").screenshot({ path: "test-results/scene-correction/xh-aura-steak-before.png" });
      }
    }
  });
});
