import { expect, test } from "@playwright/test";

type Result = {
  fixtureName: string;
  decodeStatus: string;
  orientation: { normalised: boolean };
  route: string | null;
  candidateDimensions: string | null;
  candidateValidation: { valid: boolean; transparencyRatio: number; rectangularity: number | null } | null;
  rendererAllowed: boolean;
  detectedColour: { hex: string } | null;
  finalCustomerState: string;
  preparation: { backgroundRemoved: boolean } | null;
  pass: boolean;
  failureReasons: string[];
};

const fixtures = [
  ["diellart.png", 20],
  ["xhaura.jpg", 20],
  ["aureva.png", 20],
  ["raffaello.jpg", 10],
  ["ristorante-di-mare.jpg", 10],
  ["vodafone.jpg", 10],
  ["riviera-di-mare.jpg", 10],
] as const;

async function readResult(page: import("@playwright/test").Page, name: string) {
  const raw = await page.getByTestId(`result-${name}`).textContent();
  if (!raw) throw new Error(`No machine-readable result for ${name}`);
  return JSON.parse(raw) as Result;
}

test("real fixture matrix records production-pipeline outcomes and renderer safety", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/dev/artwork-regression");
  await page.getByRole("button", { name: "Run all fixtures" }).click();
  await expect(page.getByRole("button", { name: "Run all fixtures" })).toBeEnabled({ timeout: 170_000 });

  const results = Object.fromEntries(await Promise.all(fixtures.map(async ([name]) => [name, await readResult(page, name)])));
  for (const [name] of fixtures) {
    expect(results[name].decodeStatus, `${name} must decode`).toBe("succeeded");
    expect(results[name].orientation.normalised, `${name} must use the production normalised image`).toBe(true);
  }
  expect(results["diellart.png"].rendererAllowed).toBe(true);
  expect(results["xhaura.jpg"].candidateValidation?.valid).toBe(true);
  expect(results["xhaura.jpg"].preparation?.backgroundRemoved).toBe(true);
  expect(results["xhaura.jpg"].rendererAllowed).toBe(true);
  expect(results["aureva.png"].candidateValidation?.transparencyRatio ?? 0).toBeGreaterThan(0.03);
  expect(
    !results["raffaello.jpg"].rendererAllowed ||
      (results["raffaello.jpg"].candidateValidation?.rectangularity ?? 1) < 0.9,
    "Raffaello must never render its photographed rectangle",
  ).toBeTruthy();
  const ristorante = results["ristorante-di-mare.jpg"];
  expect(
    !ristorante.rendererAllowed ||
      (ristorante.candidateValidation?.valid && (ristorante.candidateValidation.rectangularity ?? 1) < 0.9),
    "Ristorante must not hand the full rectangular photo to the renderer",
  ).toBeTruthy();
  for (const name of ["vodafone.jpg", "riviera-di-mare.jpg"] as const) {
    const result = results[name];
    expect(result.candidateValidation?.valid, `${name} must produce a valid post-crop candidate`).toBe(true);
    expect(result.candidateValidation?.transparencyRatio ?? 0, `${name} must remove the photographed field`).toBeGreaterThan(0.35);
    expect(result.candidateValidation?.rectangularity ?? 1, `${name} must not produce a solid rectangle`).toBeLessThan(0.8);
    expect(result.finalCustomerState, `${name} must enter candidate review`).toBe("review-extraction");
    expect(result.rendererAllowed, `${name} must not bypass review`).toBe(false);
  }
});

test("all real fixtures remain deterministic for the required repeated runs without URL leakage", async ({ page }) => {
  test.setTimeout(600_000);
  await page.addInitScript(() => {
    const state = window as typeof window & { regressionUrls?: { created: number; revoked: number } };
    state.regressionUrls = { created: 0, revoked: 0 };
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (object) => {
      state.regressionUrls!.created++;
      return create(object);
    };
    URL.revokeObjectURL = (url) => {
      state.regressionUrls!.revoked++;
      revoke(url);
    };
  });
  await page.goto("/dev/artwork-regression");

  for (const [name, repetitions] of fixtures) {
    const signatures = new Set<string>();
    for (let run = 0; run < repetitions; run++) {
      const section = page.getByTestId(`fixture-${name}`);
      await section.getByRole("button", { name: "Run again" }).click();
      await expect(page.getByTestId(`result-${name}`)).toBeAttached({ timeout: 120_000 });
      const result = await readResult(page, name);
      expect(result.decodeStatus, `${name} run ${run + 1}`).toBe("succeeded");
      signatures.add(JSON.stringify({
        decodeStatus: result.decodeStatus,
        orientation: result.orientation,
        route: result.route,
        candidateDimensions: result.candidateDimensions,
        detectedColour: result.detectedColour,
        finalCustomerState: result.finalCustomerState,
        rendererAllowed: result.rendererAllowed,
      }));
      await expect(section.getByRole("button", { name: "Run again" })).toBeEnabled();
    }
    expect(signatures.size, `${name} varied across ${repetitions} runs`).toBe(1);
  }

  const urls = await page.evaluate(() => (window as typeof window & { regressionUrls?: { created: number; revoked: number } }).regressionUrls);
  const displayedBlobUrls = await page.locator('img[src^="blob:"]').evaluateAll((images) =>
    new Set(images.map((image) => (image as HTMLImageElement).src)).size);
  expect((urls?.created ?? 0) - (urls?.revoked ?? 0), "only currently displayed fixture URLs may remain owned").toBe(displayedBlobUrls);
});
