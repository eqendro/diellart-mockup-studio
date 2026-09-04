import { expect, test } from "@playwright/test";
import path from "node:path";

const fixtures = [
  ["diellart", "public/brand/diellart-logo.png", null],
  ["xh-aura", "tests/assets/logos/Xh'Aura.jpeg", null],
  ["bold", "tests/assets/logos/EC.png", "Green"],
  ["thin-line", "tests/assets/logos/scene-calibration.svg", null],
] as const;

test.describe("mobile artwork rendering quality", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

  for (const [name, relativePath, colour] of fixtures) {
    test(`${name} reaches a high-density projected canvas`, async ({ page }) => {
      await page.goto("/");
      await page.locator("#gallery-logo-input").setInputFiles(path.resolve(process.cwd(), relativePath));
      await expect(page.locator(".studio-section")).toBeVisible({ timeout: 30_000 });
      if (colour) await page.getByRole("button", { name: colour, exact: true }).click();
      for (const [label, id] of [["Pjata Kryesore", "main-dish"], ["Ëmbëlsirë & Kafe", "dessert"]] as const) {
        await page.getByRole("button", { name: label, exact: true }).click();
        const canvas = page.locator(`[data-scene-id="${id}"] .scene-print-canvas`);
        await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
        await expect(canvas).toHaveAttribute("data-effective-dpr", "3");
      }
    });
  }
});
