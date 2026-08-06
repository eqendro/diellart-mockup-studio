import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const evidenceDirectory = path.resolve(process.cwd(), "temp", "browser-evidence");
fs.mkdirSync(evidenceDirectory, { recursive: true });

const asset = (filename: string) =>
  path.resolve(process.cwd(), "tests", "assets", "logos", filename);

async function openPreparedProof(page: Page, filename = "pdf-logo-diellart.png") {
  await page.goto("/");
  await page.getByLabel("Select a logo file").setInputFiles(asset(filename));
  await expect(page.locator(".mockup-logo")).toBeVisible();
  await page.waitForTimeout(600);
}

async function dispatchPointer(
  page: Page,
  type: string,
  pointerId: number,
  x: number,
  y: number,
  pointerType = "touch",
) {
  await page.locator(".mockup-logo").dispatchEvent(type, {
    pointerId,
    pointerType,
    isPrimary: pointerId === 11,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  });
}

test("desktop mouse drag moves the logo and Centre restores its position", async ({
  page,
}) => {
  await openPreparedProof(page);
  const logo = page.locator(".mockup-logo");
  const before = await logo.boundingBox();
  const beforePosition = await logo.evaluate((element) => ({
    left: Number.parseFloat(getComputedStyle(element).left),
    top: Number.parseFloat(getComputedStyle(element).top),
  }));
  expect(before).not.toBeNull();
  const centreX = before!.x + before!.width / 2;
  const centreY = before!.y + before!.height / 2;
  await page.mouse.move(centreX, centreY);
  await page.mouse.down();
  await page.mouse.move(centreX + 28, centreY + 18, { steps: 4 });
  await page.mouse.up();
  const movedPosition = await logo.evaluate((element) => ({
    left: Number.parseFloat(getComputedStyle(element).left),
    top: Number.parseFloat(getComputedStyle(element).top),
  }));
  expect(movedPosition.left).toBeGreaterThan(beforePosition.left + 10);
  expect(movedPosition.top).toBeGreaterThan(beforePosition.top + 5);
  await page.getByRole("button", { name: "Centre logo" }).click();
  await expect
    .poll(() =>
      logo.evaluate((element) => ({
        left: Number.parseFloat(getComputedStyle(element).left),
        top: Number.parseFloat(getComputedStyle(element).top),
      })),
    )
    .toEqual(beforePosition);
});

test("desktop wheel zoom and keyboard-accessible rotation handle edit artwork", async ({ page }) => {
  await openPreparedProof(page);
  const logo = page.locator(".mockup-logo");
  const before = await logo.boundingBox();
  await logo.hover();
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await logo.boundingBox())!.width).toBeGreaterThan(before!.width);

  const handle = page.getByRole("button", { name: "Rotate artwork", exact: true });
  await expect(handle).toBeVisible();
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".mockup-stage")).toHaveAttribute("data-placement-rotation", "2");
});

test("precision buttons nudge, resize, and rotate without modifier keys", async ({ page }) => {
  await openPreparedProof(page);
  await page.getByRole("button", { name: "Move logo right" }).click();
  await expect.poll(() => page.locator(".mockup-stage").getAttribute("data-placement-offset-x"))
    .not.toBe("0");
  await page.getByRole("button", { name: "Make artwork smaller" }).click();
  await expect(page.locator(".mockup-stage")).not.toHaveAttribute("data-placement-scale", "0.88");
  await page.getByRole("button", { name: "Rotate artwork clockwise" }).click();
  await expect(page.locator(".mockup-stage")).toHaveAttribute("data-placement-rotation", "2");
});

test("two touch pointers resize without leaving stale gesture state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreparedProof(page);
  const logo = page.locator(".mockup-logo");
  await expect(page.getByText("Drag to move")).toBeVisible();
  const before = await logo.boundingBox();
  const centreX = before!.x + before!.width / 2;
  const centreY = before!.y + before!.height / 2;
  await dispatchPointer(page, "pointerdown", 11, centreX - 20, centreY);
  await dispatchPointer(page, "pointerdown", 12, centreX + 20, centreY);
  await dispatchPointer(page, "pointermove", 12, centreX + 70, centreY);
  await page.waitForTimeout(50);
  const enlarged = await logo.boundingBox();
  expect(enlarged!.width).toBeGreaterThan(before!.width);
  await dispatchPointer(page, "pointerup", 12, centreX + 70, centreY);
  await expect(page.getByText("Drag to move")).toHaveCount(0);
  await dispatchPointer(page, "pointercancel", 11, centreX - 20, centreY);
  await expect(page.locator(".mockup-stage")).toHaveAttribute(
    "data-interaction-mode",
    "idle",
  );
});

test("touch drag hides the hint and replacement or re-upload resets it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreparedProof(page);
  const logo = page.locator(".mockup-logo");
  await expect(page.getByText("Drag to move")).toBeVisible();
  const box = await logo.boundingBox();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await dispatchPointer(page, "pointerdown", 21, x, y);
  await dispatchPointer(page, "pointermove", 21, x + 25, y + 12);
  await dispatchPointer(page, "pointerup", 21, x + 25, y + 12);
  await expect(page.getByText("Drag to move")).toHaveCount(0);

  await page
    .getByLabel("Select replacement logo file")
    .setInputFiles(asset("Xh'Aura.jpeg"));
  await expect(page.locator(".mockup-logo")).toBeVisible();
  await expect(page.getByText("Drag to move")).toBeVisible();

  await page.getByRole("button", { name: "Remove logo" }).click();
  await page.getByLabel("Select a logo file").setInputFiles(asset("EC.png"));
  await expect(page.locator(".mockup-logo")).toBeVisible();
  await expect(page.getByText("Drag to move")).toBeVisible();
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
]) {
  test(`mobile toolbar and compact flow at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openPreparedProof(page);
    await expect(page.getByRole("button", { name: "Replace logo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove logo" })).toBeVisible();
    await expect(page.getByText("Drag to move")).toBeVisible();
    const selectorBox = await page.locator(".mobile-print-colour").boundingBox();
    const stageBox = await page.locator(".proof-stage").boundingBox();
    expect(selectorBox!.y + selectorBox!.height).toBeLessThan(stageBox!.y);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
    const fineTune = page.locator("details.fine-tune-placement");
    await expect(fineTune).not.toHaveAttribute("open", "");
    await expect(page.getByRole("button", { name: "Approve digital proof" })).toBeVisible();
    await page.screenshot({
      path: path.join(
        evidenceDirectory,
        `mobile-proof-${viewport.width}x${viewport.height}.png`,
      ),
      fullPage: true,
    });
    await fineTune.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(fineTune).toHaveAttribute("open", "");
    await expect(page.locator(".proof-stage")).toHaveCSS("touch-action", "auto");
    await expect(page.locator(".mockup-logo")).toHaveCSS("touch-action", "none");
  });
}

for (const scenario of [
  { filename: "pdf-logo-diellart.png", label: "diellart", width: 360, height: 800 },
  { filename: "Xh'Aura.jpeg", label: "xh-aura", width: 390, height: 844 },
  { filename: "EC.png", label: "ec-analytics", width: 412, height: 915 },
]) {
  test(`mobile prepared proof remains usable for ${scenario.label}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await openPreparedProof(page, scenario.filename);
    await expect(page.locator(".mockup-product-image")).toBeVisible();
    await expect(page.locator(".mockup-logo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Replace logo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove logo" })).toBeVisible();
    await expect(page.locator("details.fine-tune-placement")).not.toHaveAttribute(
      "open",
      "",
    );
    await page.screenshot({
      path: path.join(
        evidenceDirectory,
        `mobile-${scenario.label}-${scenario.width}x${scenario.height}.png`,
      ),
      fullPage: true,
    });
  });
}
