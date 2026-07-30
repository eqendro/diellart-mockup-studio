import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PRINT_COLOURS } from "../../src/features/logo-engine/monochrome/config";

const evidenceDirectory = path.resolve(process.cwd(), "temp", "browser-evidence");
fs.mkdirSync(evidenceDirectory, { recursive: true });
const asset = (filename: string) =>
  path.resolve(process.cwd(), "tests", "assets", "logos", filename);

async function upload(page: Page, filename: string) {
  await page.goto("/");
  await page.getByLabel("Select a logo file").setInputFiles(asset(filename));
  await expect(page.locator(".mockup-logo")).toBeVisible();
}

async function renderedPixelColours(page: Page) {
  return page.locator(".mockup-logo").evaluate(async (image) => {
    const artwork = image as HTMLImageElement;
    await artwork.decode();
    const canvas = document.createElement("canvas");
    canvas.width = artwork.naturalWidth;
    canvas.height = artwork.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(artwork, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colours = new Set<string>();
    for (let offset = 0; offset < data.length; offset += 4) {
      const protectedWhite =
        data[offset] >= 242 &&
        data[offset + 1] >= 242 &&
        data[offset + 2] >= 242;
      if (data[offset + 3] > 0 && !protectedWhite) {
        colours.add(`${data[offset]},${data[offset + 1]},${data[offset + 2]}`);
      }
    }
    return [...colours];
  });
}

function expectMonochromeNear(colours: string[], expected: string, tolerance = 3) {
  const target = expected.split(",").map(Number);
  expect(colours.length).toBeGreaterThan(0);
  for (const colour of colours) {
    const channels = colour.split(",").map(Number);
    channels.forEach((channel, index) =>
      expect(Math.abs(channel - target[index])).toBeLessThanOrEqual(tolerance),
    );
  }
}

test("EC Analytics detects red and every option produces a true monochrome asset", async ({
  page,
}) => {
  await upload(page, "EC.png");
  const logo = page.locator(".mockup-logo");
  const initialPosition = await logo.evaluate((element) => ({
    left: getComputedStyle(element).left,
    top: getComputedStyle(element).top,
    width: getComputedStyle(element).width,
  }));
  const brand = page.getByRole("button", { name: "Detected colour" });
  await expect(brand).toHaveAttribute("aria-pressed", "true");
  const brandSwatch = brand.locator(".print-colour-swatch");
  await expect(brandSwatch).toHaveCSS("background-color", "rgb(231, 0, 77)");

  const options = [
    { name: "Detected colour", rgb: "231,0,77", screenshot: "brand" },
    { name: "Black", rgb: "0,0,0", screenshot: "black" },
    { name: "Blue", rgb: "0,87,184", screenshot: "blue" },
    { name: "Green", rgb: "0,132,61", screenshot: "green" },
  ];
  for (const option of options) {
    const previousUrl = await logo.getAttribute("src");
    await page.getByRole("button", { name: option.name }).click();
    if (option.name !== "Detected colour") {
      await expect.poll(() => logo.getAttribute("src")).not.toBe(previousUrl);
    }
    await expect(page.getByRole("button", { name: option.name })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expectMonochromeNear(await renderedPixelColours(page), option.rgb);
    expect(
      await logo.evaluate((element) => ({
        left: getComputedStyle(element).left,
        top: getComputedStyle(element).top,
        width: getComputedStyle(element).width,
      })),
    ).toEqual(initialPosition);
    await page.screenshot({
      path: path.join(evidenceDirectory, `ec-print-${option.screenshot}.png`),
      fullPage: true,
    });
  }

  await page.getByRole("button", { name: "Approve digital proof" }).click();
  await expect(page.getByRole("complementary", { name: "Artwork controls" })).toHaveAttribute(
    "data-approved-print-colour",
    PRINT_COLOURS.green,
  );
  await page.getByRole("button", { name: "Edit placement" }).click();
  await expect(page.getByRole("button", { name: "Green" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("neutral Xh'Aura defaults to black and mobile selector stays above approval", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await upload(page, "Xh'Aura.jpeg");
  await expect(page.getByRole("button", { name: "Black" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await renderedPixelColours(page)).toEqual(["0,0,0"]);
  const selectorBox = await page
    .locator(".mobile-print-colour .print-colour-selector")
    .boundingBox();
  const proofBox = await page.locator(".proof-stage").boundingBox();
  const approvalBox = await page
    .getByRole("button", { name: "Approve digital proof" })
    .boundingBox();
  expect(selectorBox!.y + selectorBox!.height).toBeLessThan(proofBox!.y);
  expect(selectorBox!.y).toBeLessThan(approvalBox!.y);
  expect(selectorBox!.x).toBeGreaterThanOrEqual(0);
  expect(selectorBox!.x + selectorBox!.width).toBeLessThanOrEqual(390);
});

test("DiellArt final proof is monochrome", async ({ page }) => {
  await upload(page, "pdf-logo-diellart.png");
  const swatchColour = await page
    .getByRole("button", { name: "Detected colour" })
    .locator(".print-colour-swatch")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const expected = swatchColour.match(/\d+/g)!.slice(0, 3).join(",");
  expectMonochromeNear(await renderedPixelColours(page), expected, 12);
});

test("colour labels, supporting copy, and keyboard selection are accessible", async ({
  page,
}) => {
  await upload(page, "EC.png");
  await expect(page.getByRole("button", { name: "Detected colour" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Brand colour" })).toHaveCount(0);
  await expect(
    page
      .locator(".desktop-print-colour")
      .getByText("Select how your logo will be printed."),
  ).toBeVisible();
  const blue = page.getByRole("button", { name: "Blue" });
  await blue.focus();
  await page.keyboard.press("Enter");
  await expect(blue).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Approve digital proof" })).toBeVisible();
});

test("desktop keeps print colour in the side panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await upload(page, "EC.png");
  const sidebar = page.getByRole("complementary", { name: "Artwork controls" });
  await expect(sidebar.locator(".desktop-print-colour")).toBeVisible();
  await expect(page.locator(".mobile-print-colour")).toBeHidden();
  await expect(
    sidebar.getByRole("group", { name: "Print colour" }),
  ).toBeVisible();
});
