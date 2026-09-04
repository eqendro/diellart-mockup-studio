import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const logo = path.resolve(process.cwd(), "tests/assets/logos/scene-calibration.svg");
const evidence = (name: string) => path.resolve(process.cwd(), "temp/browser-evidence", name);

async function openPreparedStudio(page: Page) {
  await page.goto("/");
  await page.locator("#gallery-logo-input").setInputFiles(logo);
  await expect(page.locator(".studio-section")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".mockup-logo")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Produkti" })).toHaveAttribute("aria-pressed", "true");
}

async function relativeArtworkGeometry(page: Page) {
  return page.locator(".mockup-logo").evaluate((element) => {
    const artwork = element as HTMLElement;
    const stageBox = artwork.closest<HTMLElement>(".mockup-stage")!.getBoundingClientRect();
    return {
      left: Number.parseFloat(artwork.style.left) / stageBox.width,
      top: Number.parseFloat(artwork.style.top) / stageBox.height,
      width: Number.parseFloat(artwork.style.width) / stageBox.width,
      rotation: artwork.style.transform,
    };
  });
}

async function expectUndistortedLifestyle(page: Page) {
  const box = await page.locator(".studio-lifestyle-frame .scene-stage").boundingBox();
  expect(box).not.toBeNull();
  expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(1.5, 2);
}

async function expectCtaInViewport(page: Page, viewportHeight: number) {
  const box = await page.getByRole("link", { name: /Na kontakto/i }).boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? viewportHeight) + (box?.height ?? 0)).toBeLessThanOrEqual(viewportHeight);
}

test("desktop conversion rail fits and preserves editing through every scene", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPreparedStudio(page);
  const artwork = page.locator(".mockup-logo");
  await artwork.dragTo(page.locator(".mockup-stage"), { targetPosition: { x: 240, y: 390 } });
  await page.getByRole("button", { name: "Make artwork larger" }).click();
  await page.getByRole("button", { name: "Rotate artwork clockwise" }).click();
  await page.getByRole("button", { name: "Black" }).click();
  await expect(page.getByRole("button", { name: "Move logo right" })).toHaveCount(0);
  const editedGeometry = await relativeArtworkGeometry(page);
  await expectCtaInViewport(page, 900);
  await page.screenshot({ path: evidence("studio-product-desktop-1440x900.png") });

  await page.getByRole("button", { name: "Pjata Kryesore" }).click();
  await expectUndistortedLifestyle(page);
  await expect(page.getByRole("button", { name: "Make artwork larger" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Rotate artwork clockwise" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Black" })).toBeVisible();
  await expectCtaInViewport(page, 900);
  await page.screenshot({ path: evidence("studio-main-dish-desktop-1440x900.png") });

  await page.getByRole("button", { name: "Ëmbëlsirë & Kafe" }).click();
  await expectUndistortedLifestyle(page);
  await page.screenshot({ path: evidence("studio-dessert-desktop-1440x900.png") });

  await page.getByRole("button", { name: "Produkti" }).click();
  const restoredGeometry = await relativeArtworkGeometry(page);
  expect(restoredGeometry.left).toBeCloseTo(editedGeometry.left, 2);
  expect(restoredGeometry.top).toBeCloseTo(editedGeometry.top, 2);
  expect(restoredGeometry.width).toBeCloseTo(editedGeometry.width, 2);
  expect(restoredGeometry.rotation).toBe(editedGeometry.rotation);
});

test("compact desktop keeps the full conversion rail visible", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openPreparedStudio(page);
  await expectCtaInViewport(page, 768);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: evidence("studio-product-desktop-1366x768.png") });
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
  { width: 360, height: 640 },
]) {
  test(`mobile Studio remains safe at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openPreparedStudio(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const tabs = await page.locator(".studio-scene-selector").boundingBox();
    const preview = await page.locator(".studio-preview-frame").boundingBox();
    expect(tabs?.y).toBeLessThan(preview?.y ?? 0);
  });
}

test("390px mobile scenes preserve image ratio and conversion order", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreparedStudio(page);
  await page.screenshot({ path: evidence("studio-product-mobile-390x844.png") });
  await page.getByRole("button", { name: "Pjata Kryesore" }).click();
  await expectUndistortedLifestyle(page);
  await expect(page.getByRole("button", { name: "Make artwork larger" })).toHaveCount(0);
  await page.screenshot({ path: evidence("studio-main-dish-mobile-390x844.png") });
  await page.getByRole("button", { name: "Ëmbëlsirë & Kafe" }).click();
  await expectUndistortedLifestyle(page);
  await page.screenshot({ path: evidence("studio-dessert-mobile-390x844.png") });
});
