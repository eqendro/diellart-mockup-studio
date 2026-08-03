import path from "node:path";
import { expect, test } from "@playwright/test";

const fixture = (name: string) => path.resolve(process.cwd(), "tests/assets/logos", name);

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
]) {
  test(`native gallery and camera controls activate at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto("/");

    const gallery = page.locator("#gallery-logo-input");
    const camera = page.locator("#camera-logo-input");
    await expect(gallery).toBeAttached();
    await expect(camera).toBeAttached();
    await expect(gallery).toBeEnabled();
    await expect(camera).toBeEnabled();
    await expect(gallery).toHaveAttribute("accept", /image\/png/);
    await expect(gallery).not.toHaveAttribute("capture");
    await expect(camera).toHaveAttribute("accept", "image/*");
    await expect(camera).toHaveAttribute("capture", "environment");
    await expect(page.locator('label[for="gallery-logo-input"]')).toHaveCount(1);
    await expect(page.locator('label[for="camera-logo-input"]')).toHaveCount(1);

    const galleryChooser = page.waitForEvent("filechooser");
    await page.getByText("Choose from device", { exact: true }).click();
    expect(await (await galleryChooser).element().getAttribute("id")).toBe("gallery-logo-input");

    const cameraChooser = page.waitForEvent("filechooser");
    await page.getByText("Take a photo", { exact: true }).click();
    expect(await (await cameraChooser).element().getAttribute("id")).toBe("camera-logo-input");
    expect(pageErrors).toEqual([]);
  });
}

test("gallery and camera input events enter the same visible processing chain", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    (window as typeof window & { uploadHeadings?: string[] }).uploadHeadings = [];
    window.addEventListener("DOMContentLoaded", () => {
      new MutationObserver(() => {
        const heading = document.querySelector("#logo-upload-heading")?.textContent;
        if (heading) (window as typeof window & { uploadHeadings: string[] }).uploadHeadings.push(heading);
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    });
  });
  await page.goto("/?debugUpload=1");
  const gallery = page.locator("#gallery-logo-input");
  await gallery.setInputFiles(fixture("Xh'Aura.jpeg"));
  await expect(page.getByText(/resulting route:/)).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { uploadHeadings: string[] }).uploadHeadings))
    .toContain("Reading your image…");
  await expect(page.getByText(/change event fired:/)).toBeVisible();
  await expect(page.getByText(/upload state updated: accepted/)).toBeVisible();
  await expect(gallery).toBeAttached();

  await page.goto("/?debugUpload=1");
  const camera = page.locator("#camera-logo-input");
  await camera.setInputFiles(fixture("Xh'Aura.jpeg"));
  await expect(page.getByText(/resulting route:/)).toBeVisible();
  await expect(page.getByText(/first File obtained: camera/)).toBeVisible();
});

test("bitmap rejection uses the HTML decoder fallback and continues", async ({ page }) => {
  await page.addInitScript(() => {
    window.createImageBitmap = () => Promise.reject(new DOMException("forced bitmap failure", "NotSupportedError"));
  });
  await page.goto("/?debugUpload=1");
  await page.locator("#gallery-logo-input").setInputFiles(fixture("Xh'Aura.jpeg"));
  await expect(page.getByText(/HTMLImageElement fallback attempted/).first()).toBeVisible();
  await expect(page.getByText(/resulting route:/)).toBeVisible();
  await expect(page.getByText(/decode failed:/)).toHaveCount(0);
});

test("unsupported bitmap options retry plain createImageBitmap before HTML fallback", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.createImageBitmap.bind(window);
    window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
      if (args.length > 1) return Promise.reject(new DOMException("options unsupported", "NotSupportedError"));
      return original(...args);
    }) as typeof createImageBitmap;
  });
  await page.goto("/?debugUpload=1");
  await page.locator("#gallery-logo-input").setInputFiles(fixture("Xh'Aura.jpeg"));
  await expect(page.getByText(/createImageBitmap-options failed: NotSupportedError/).first()).toBeVisible();
  await expect(page.getByText(/createImageBitmap-plain result:/).first()).toBeVisible();
  await expect(page.getByText(/HTMLImageElement fallback attempted/)).toHaveCount(0);
  await expect(page.getByText(/resulting route:/)).toBeVisible();
});

test("HTML onload remains successful when img.decode rejects", async ({ page }) => {
  await page.addInitScript(() => {
    window.createImageBitmap = () => Promise.reject(new DOMException("forced bitmap failure", "NotSupportedError"));
    HTMLImageElement.prototype.decode = () => Promise.reject(new DOMException("forced decode rejection", "EncodingError"));
  });
  await page.goto("/dev/photo-intake");
  await page.locator("#canonical-decoder-input").setInputFiles(fixture("Xh'Aura.jpeg"));
  await expect(page.getByTestId("decoder-trace")).toContainText("img.onload result");
  await expect(page.getByTestId("decoder-trace")).toContainText("img.decode result: non-fatal rejection");
  await expect(page.getByTestId("decoder-result")).toContainText("Success");
  await expect(page.getByTestId("decoder-result")).toContainText("html-image-object-url");
});

test("direct decoder diagnostic uses the canonical production decoder", async ({ page }) => {
  await page.goto("/dev/photo-intake");
  await page.locator("#canonical-decoder-input").setInputFiles(fixture("Xh'Aura.jpeg"));
  await expect(page.getByTestId("decoder-result")).toContainText("Xh'Aura.jpeg");
  await expect(page.getByTestId("decoder-result")).toContainText("image/jpeg");
  await expect(page.getByTestId("decoder-result")).toContainText("browser-decoded");
  await expect(page.getByTestId("decoder-result")).toContainText("Success");
  await expect(page.getByTestId("decoder-trace")).toContainText("getImageData result: success");
});

test("object URL remains alive until the HTML image has been drawn", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { decoderOrder?: string[] };
    state.decoderOrder = [];
    window.createImageBitmap = () => Promise.reject(new DOMException("force HTML", "NotSupportedError"));
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      state.decoderOrder?.push("revoke");
      revoke(url);
    };
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
      state.decoderOrder?.push("draw");
      return (draw as unknown as (...values: unknown[]) => void).apply(this, args);
    } as CanvasRenderingContext2D["drawImage"];
  });
  await page.goto("/dev/photo-intake");
  await page.locator("#canonical-decoder-input").setInputFiles(fixture("Xh'Aura.jpeg"));
  await expect(page.getByTestId("decoder-result")).toContainText("Success");
  const order = await page.evaluate(() => (window as typeof window & { decoderOrder: string[] }).decoderOrder);
  expect(order.indexOf("draw")).toBeGreaterThanOrEqual(0);
  expect(order.indexOf("revoke")).toBeGreaterThan(order.indexOf("draw"));
});

test("canvas failure retries once at a reduced working dimension", async ({ page }) => {
  await page.addInitScript(() => {
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    let attempts = 0;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
      attempts++;
      if (attempts === 1) throw new DOMException("forced memory pressure", "InvalidStateError");
      return (draw as unknown as (...values: unknown[]) => void).apply(this, args);
    } as CanvasRenderingContext2D["drawImage"];
  });
  await page.goto("/dev/photo-intake");
  await page.locator("#canonical-decoder-input").setInputFiles(fixture("Xh'Aura.jpeg"));
  await expect(page.getByTestId("decoder-trace")).toContainText("reduced-memory retry");
  await expect(page.getByTestId("decoder-result")).toContainText("Success");
});

test("all decoder failures are visible with the exact failing stages", async ({ page }) => {
  await page.addInitScript(() => {
    window.createImageBitmap = () => Promise.reject(new DOMException("bitmap unavailable", "NotSupportedError"));
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      set() {
        queueMicrotask(() => this.onerror?.(new Event("error")));
      },
    });
  });
  await page.goto("/dev/photo-intake");
  await page.locator("#canonical-decoder-input").setInputFiles(fixture("Xh'Aura.jpeg"));
  await expect(page.getByTestId("decoder-result")).toContainText("ALL_DECODERS_FAILED");
  await expect(page.getByTestId("decoder-trace")).toContainText("html-image-object-url failed");
  await expect(page.getByTestId("decoder-trace")).toContainText("html-image-data-url failed");
});

test("same-file reselection and camera backgrounding remain recoverable", async ({ page }) => {
  await page.goto("/?debugUpload=1");
  const gallery = page.locator("#gallery-logo-input");
  await gallery.setInputFiles(fixture("EC.png"));
  await expect(page.getByText(/upload state updated: accepted/)).toBeVisible();
  await page.evaluate(() => {
    const state = window as typeof window & { sameFileChanges?: number };
    state.sameFileChanges = 0;
    document.querySelector("#gallery-logo-input")?.addEventListener("change", () => state.sameFileChanges = (state.sameFileChanges ?? 0) + 1);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await gallery.setInputFiles(fixture("EC.png"));
  expect(await page.evaluate(() => (window as typeof window & { sameFileChanges: number }).sameFileChanges)).toBe(1);
  await expect(page.locator(".upload-error")).toHaveCount(0);
});

test("isolated development input reports native file metadata", async ({ page }) => {
  await page.goto("/dev/photo-intake");
  await page.locator("#isolated-native-file-input").setInputFiles(fixture("EC.png"));
  await expect(page.getByTestId("native-input-result")).toContainText("Change received: EC.png; image/png;");
});

test("development page hydrates and receives ordinary React events", async ({ page }) => {
  await page.goto("/dev/photo-intake");
  await expect(page.getByTestId("hydration-status")).toHaveText("React hydrated");
  await page.getByRole("button", { name: "Increment test" }).click();
  await expect(page.getByTestId("hydration-count")).toHaveText("1");
  await page.locator("#react-text-probe").fill("Samsung event test");
  await expect(page.getByTestId("react-events")).toContainText("React text change: Samsung event test");
  await page.locator("#react-file-probe").setInputFiles(fixture("EC.png"));
  await expect(page.getByTestId("react-events")).toContainText("React file change: EC.png; image/png;");
  await expect(page.getByTestId("client-errors")).toHaveText("No client runtime error recorded.");
});

test("development watchdog reports picker return without change", async ({ page }) => {
  await page.goto("/?debugUpload=1");
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Choose from device", { exact: true }).click();
  await chooser;
  await page.waitForTimeout(600);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText(/Picker returned, but no file change event was received/)).toBeVisible();
});
