import path from "node:path";
import { expect, test } from "@playwright/test";

const evidencePath = (name: string) =>
  path.resolve(process.cwd(), "temp/browser-evidence", name);

test("desktop hero preserves its hierarchy and refined studio treatment", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");

  const hero = page.locator(".hero");
  const primaryLine = page.locator(".hero .text-display");
  const secondaryLine = page.locator(".hero .text-display span");
  const panel = page.locator(".hero-upload");

  await expect(hero).toBeVisible();
  await expect(page.getByRole("button", { name: "Zgjidh logon" })).toBeVisible();
  await expect(page.locator(".upload-instructions-desktop")).toBeVisible();
  await expect(page.locator(".upload-instructions-mobile")).toBeHidden();
  await expect(primaryLine).toHaveCSS("color", "rgb(243, 239, 229)");
  await expect(secondaryLine).toHaveCSS("color", "rgb(201, 168, 106)");
  await expect(panel).toHaveCSS("animation-name", "none");
  expect(await panel.evaluate((element) => getComputedStyle(element, "::before").animationName))
    .toBe("hero-sun-border");
  expect(await panel.evaluate((element) => getComputedStyle(element, "::before").animationDuration))
    .toBe("12s");

  await hero.screenshot({ path: evidencePath("hero-refinement-desktop.png") });
});

for (const viewport of [
  { width: 360, height: 800, screenshot: "hero-mobile-compact-360.png" },
  { width: 390, height: 844 },
  { width: 430, height: 932, screenshot: "hero-mobile-compact-430.png" },
  { width: 360, height: 640 },
]) {
  test(`mobile hero remains compact and safe at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const cta = page.getByRole("link", { name: "Shijo ndjesinë" });
    const panel = page.locator(".hero-upload");
    await expect(cta).toBeVisible();
    await expect(page.locator(".upload-instructions-mobile")).toHaveText("PNG · JPG · SVG · WebP");
    await expect(page.locator(".upload-instructions-mobile")).toBeVisible();
    await expect(page.locator(".upload-instructions-desktop")).toBeHidden();
    expect((await cta.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect((await panel.boundingBox())?.y).toBeLessThan(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    if (viewport.screenshot) {
      await page.screenshot({ path: evidencePath(viewport.screenshot) });
    }
  });
}

test("sun-border motion is disabled for reduced-motion visitors", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const duration = await page.locator(".hero-upload").evaluate(
    (element) => getComputedStyle(element, "::before").animationDuration,
  );
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.00001);
});
