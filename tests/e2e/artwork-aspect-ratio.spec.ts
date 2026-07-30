import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const evidenceDirectory = path.resolve(process.cwd(), "temp", "browser-evidence");
fs.mkdirSync(evidenceDirectory, { recursive: true });
const asset = (filename: string) =>
  path.resolve(process.cwd(), "tests", "assets", "logos", filename);

async function upload(page: Page, filename: string) {
  await page.goto("/");
  await page.getByLabel("Select a logo file").setInputFiles(asset(filename));
  await expect(page.locator(".mockup-logo")).toBeVisible();
}

async function expectIntrinsicRatio(page: Page) {
  const geometry = await page.locator(".mockup-logo").evaluate((element) => {
    const image = element as HTMLImageElement;
    const bounds = image.getBoundingClientRect();
    return {
      rendered: bounds.width / bounds.height,
      intrinsic: image.naturalWidth / image.naturalHeight,
      objectFit: getComputedStyle(image).objectFit,
      height: getComputedStyle(image).height,
    };
  });
  expect(Math.abs(geometry.rendered - geometry.intrinsic)).toBeLessThan(0.001);
  expect(geometry.objectFit).not.toBe("fill");
  expect(geometry.height).not.toBe("100%");
}

const assets = [
  { filename: "pdf-logo-diellart.png", label: "diellart" },
  { filename: "EC.png", label: "ec-analytics" },
  { filename: "Xh'Aura.jpeg", label: "xh-aura" },
];
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 1280, height: 900 },
];

for (const currentAsset of assets) {
  test(`${currentAsset.label} preserves aspect ratio across layout and colour`, async ({
    page,
  }) => {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await upload(page, currentAsset.filename);
      await expectIntrinsicRatio(page);
      for (const colour of ["Detected colour", "Black", "Blue", "Green"]) {
        const logo = page.locator(".mockup-logo");
        const previousUrl = await logo.getAttribute("src");
        await page.getByRole("button", { name: colour }).click();
        if (
          colour !== "Detected colour" &&
          !(currentAsset.label === "xh-aura" && colour === "Black")
        ) {
          await expect.poll(() => logo.getAttribute("src")).not.toBe(previousUrl);
        }
        await expect(logo).toBeVisible();
        await expectIntrinsicRatio(page);
      }
    }
    await page.screenshot({
      path: path.join(
        evidenceDirectory,
        `aspect-ratio-${currentAsset.label}.png`,
      ),
      fullPage: true,
    });
  });
}

test("responsive resize preserves normalized placement", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await upload(page, "EC.png");
  await page.getByRole("button", { name: "Move logo right" }).click();
  await page.getByRole("button", { name: "Move logo up" }).click();
  const stage = page.locator(".mockup-stage");
  const before = await stage.evaluate((element) => ({
    scale: element.getAttribute("data-placement-scale"),
    offsetX: element.getAttribute("data-placement-offset-x"),
    offsetY: element.getAttribute("data-placement-offset-y"),
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      stage.evaluate((element) => ({
        scale: element.getAttribute("data-placement-scale"),
        offsetX: element.getAttribute("data-placement-offset-x"),
        offsetY: element.getAttribute("data-placement-offset-y"),
      })),
    )
    .toEqual(before);
  await expectIntrinsicRatio(page);
});
