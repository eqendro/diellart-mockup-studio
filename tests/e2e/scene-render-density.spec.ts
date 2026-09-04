import { expect, test } from "@playwright/test";
import path from "node:path";

const artwork = path.resolve(process.cwd(), "tests/assets/logos/scene-calibration.svg");

test.describe("high-density ScenePreview rendering", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

  test("uses a DPR-aware backing store without changing CSS geometry", async ({ page }) => {
    await page.goto("/");
    await page.locator("#gallery-logo-input").setInputFiles(artwork);
    await expect(page.locator(".studio-section")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Pjata Kryesore", exact: true }).click();
    const canvas = page.locator('[data-scene-id="main-dish"] .scene-print-canvas');
    await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
    const density = await canvas.evaluate((element) => {
      const target = element as HTMLCanvasElement;
      const bounds = target.getBoundingClientRect();
      return {
        backingWidth: target.width,
        backingHeight: target.height,
        cssWidth: bounds.width,
        cssHeight: bounds.height,
        renderedCssWidth: Number(target.dataset.cssWidth),
        renderedCssHeight: Number(target.dataset.cssHeight),
        effectiveDpr: Number(target.dataset.effectiveDpr),
      };
    });
    expect(density.effectiveDpr).toBe(3);
    expect(density.backingWidth).toBe(Math.round(density.renderedCssWidth * 3));
    expect(density.backingHeight).toBe(Math.round(density.renderedCssHeight * 3));
    expect(Math.abs(density.cssWidth - density.renderedCssWidth)).toBeLessThan(1);
    expect(Math.abs(density.cssHeight - density.renderedCssHeight)).toBeLessThan(1);
  });
});
