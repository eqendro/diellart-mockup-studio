import path from "node:path";
import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const asset = (filename: string) =>
  path.resolve(process.cwd(), "tests", "assets", "logos", filename);
const evidenceDirectory = path.resolve(process.cwd(), "temp", "browser-evidence");

fs.mkdirSync(evidenceDirectory, { recursive: true });

async function upload(page: Page, filename: string) {
  page.on("console", (message) =>
    console.log(`[browser:${message.type()}] ${message.text()}`),
  );
  page.on("pageerror", (error) => console.log(`[browser:pageerror] ${error.stack}`));
  await page.goto("/");
  await page.getByLabel("Select a logo file").setInputFiles(asset(filename));
}

async function expectProofIsNotBlank(page: Page) {
  const proof = page.locator(".proof-stage");
  await expect(proof).toBeVisible();
  await expect
    .poll(async () =>
      proof
        .locator(".mockup-stage, .customer-status, .upload-error, #logo-upload")
        .count(),
    )
    .toBeGreaterThan(0);
}

test("transparent DiellArt PNG renders the product, logo, and controls", async ({
  page,
}) => {
  await upload(page, "pdf-logo-diellart.png");
  await expectProofIsNotBlank(page);
  await expect(page.locator(".mockup-product-image")).toBeVisible();
  await expect(page.locator(".mockup-logo")).toBeVisible();
  await expect(page.getByText("We could not prepare this image.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Select logo area" })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Artwork controls" })).toBeVisible();
  await page.screenshot({
    path: path.join(evidenceDirectory, "diellart-transparent.png"),
    fullPage: true,
  });
});

for (const filename of ["Xh'Aura.jpeg", "EC.png"]) {
  test(`${filename} reaches preview or logo-area selection without an early error`, async ({
    page,
  }) => {
    await upload(page, filename);
    await expectProofIsNotBlank(page);
    await expect
      .poll(async () => {
        if (await page.locator(".mockup-stage").count()) return "preview";
        if (await page.getByRole("button", { name: "Select logo area" }).count())
          return "select";
        return "pending";
      })
      .not.toBe("pending");
    await expect(page.locator(".mockup-product-image")).toBeVisible();
    await expect(page.getByText("We could not prepare this image.")).toHaveCount(0);
    if (await page.getByRole("button", { name: "Select logo area" }).count()) {
      await expect(page.getByRole("button", { name: "Select logo area" })).toBeVisible();
    } else {
      await expect(page.locator(".mockup-logo")).toBeVisible();
      await expect(
        page.getByRole("complementary", { name: "Artwork controls" }),
      ).toBeVisible();
    }
    await page.screenshot({
      path: path.join(
        evidenceDirectory,
        filename === "EC.png" ? "ec-analytics.png" : "xh-aura.png",
      ),
      fullPage: true,
    });
  });
}
