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
    await expect(page.getByRole("button", { name: "Choose logo file" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Take a photo", exact: true })).toHaveCount(1);

    const galleryChooser = page.waitForEvent("filechooser");
    await page.getByText("Choose logo file", { exact: true }).click();
    expect(await (await galleryChooser).element().getAttribute("id")).toBe("gallery-logo-input");

    const cameraChooser = page.waitForEvent("filechooser");
    await page.getByText("Take a photo", { exact: true }).click();
    expect(await (await cameraChooser).element().getAttribute("id")).toBe("camera-logo-input");
    expect(pageErrors).toEqual([]);
  });
}

test("desktop keeps the stored-file workflow and does not expose the mobile camera action", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Choose logo file" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Take a photo", exact: true })).toBeHidden();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose logo file" }).click();
  expect(await (await chooser).element().getAttribute("id")).toBe("gallery-logo-input");
});

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
  await expect(page.getByText(/final route:/)).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { uploadHeadings: string[] }).uploadHeadings))
    .toContain("Reading your image…");
  await expect(page.getByText(/change event fired:/)).toBeVisible();
  await expect(page.getByText(/upload state updated: accepted/)).toBeVisible();
  await expect(gallery).toBeAttached();

  await page.goto("/?debugUpload=1");
  const camera = page.locator("#camera-logo-input");
  await camera.setInputFiles(fixture("Xh'Aura.jpeg"));
  await expect(page.getByText(/final route:/)).toBeVisible();
  await expect(page.getByText(/first File obtained: camera/)).toBeVisible();
});

test("native input remains mounted and retains the File until owned bytes resolve", async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    const state = window as typeof window & { ownershipProbe?: Record<string, boolean> };
    state.ownershipProbe = {};
    File.prototype.arrayBuffer = async function () {
      state.ownershipProbe!.started = true;
      await new Promise((resolve) => setTimeout(resolve, 350));
      const input = document.querySelector<HTMLInputElement>("#gallery-logo-input");
      state.ownershipProbe!.mountedDuringRead = Boolean(input?.isConnected);
      state.ownershipProbe!.retainedDuringRead = input?.files?.length === 1;
      return original.call(this);
    };
  });
  await page.goto("/?debugUpload=1");
  const input = page.locator("#gallery-logo-input");
  await input.setInputFiles(fixture("EC.png"));
  await expect.poll(() => page.evaluate(() => (window as typeof window & { ownershipProbe?: Record<string, boolean> }).ownershipProbe?.started)).toBe(true);
  await expect(input).toBeAttached();
  await expect.poll(() => input.evaluate((element: HTMLInputElement) => element.files?.length)).toBe(1);
  await expect(page.getByText(/input reset after ownership: success/)).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { ownershipProbe?: Record<string, boolean> }).ownershipProbe)).toMatchObject({
    mountedDuringRead: true,
    retainedDuringRead: true,
  });
  await expect.poll(() => input.evaluate((element: HTMLInputElement) => element.files?.length)).toBe(0);
});

test("primary provider failure uses one FileReader fallback before resetting the input", async ({ page }) => {
  await page.addInitScript(() => {
    let calls = 0;
    File.prototype.arrayBuffer = async function () {
      calls++;
      throw new DOMException(`forced provider failure ${calls}`, "NotReadableError");
    };
  });
  await page.goto("/?debugUpload=1");
  await page.locator("#gallery-logo-input").setInputFiles(fixture("EC.png"));
  await expect(page.getByText(/primary copy failed:/)).toBeVisible();
  await expect(page.getByText(/fallback copy started:/)).toBeVisible();
  await expect(page.getByText(/fallback copy succeeded:/)).toBeVisible();
  await expect(page.getByText(/input reset after ownership: success/)).toBeVisible();
  await expect(page.getByText(/upload state updated: accepted/)).toBeVisible();
});

test("provider NotReadableError enters recovery and both actions reopen native inputs", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", { configurable: true, value: undefined });
    File.prototype.arrayBuffer = () => Promise.reject(new DOMException("primary failed", "NotReadableError"));
    FileReader.prototype.readAsArrayBuffer = function () {
      const state = window as typeof window & { providerReadAttempts?: number; terminalProbe?: { mounted: boolean; retained: boolean } };
      state.providerReadAttempts = (state.providerReadAttempts ?? 0) + 1;
      const input = document.querySelector<HTMLInputElement>("#gallery-logo-input");
      state.terminalProbe = {
        mounted: Boolean(input?.isConnected),
        retained: input?.files?.length === 1,
      };
      setTimeout(() => this.dispatchEvent(new ProgressEvent("error")), 150);
    };
  });
  await page.goto("/?debugUpload=1");
  const input = page.locator("#gallery-logo-input");
  await input.setInputFiles(fixture("EC.png"));
  await expect(page.getByText(/fallback copy started:/)).toBeVisible();
  await expect(page.getByText(/fallback copy failed:/)).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { terminalProbe?: { mounted: boolean; retained: boolean } }).terminalProbe)).toEqual({ mounted: true, retained: true });
  await expect(page.getByText(/input reset after ownership: terminal failure/)).toBeVisible();
  await expect(page.getByText("This photo could not be opened", { exact: true })).toBeVisible();
  await expect(page.getByText("Your phone returned a temporary photo preview instead of the original file. Choose the image through Files or Browse.", { exact: true })).toBeVisible();
  await expect(page.getByText(/recovery state entered: android-provider-file-unreadable/)).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { providerReadAttempts?: number }).providerReadAttempts)).toBe(1);
  await expect.poll(() => input.evaluate((element: HTMLInputElement) => element.files?.length)).toBe(0);

  const fileChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose through Files" }).click();
  expect(await (await fileChooser).element().getAttribute("id")).toBe("gallery-logo-input");
  await expect(page.getByText(/recovery action selected: Choose through Files/)).toBeVisible();

  const cameraChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Take a photo instead" }).click();
  expect(await (await cameraChooser).element().getAttribute("id")).toBe("camera-logo-input");
  await expect(page.getByText(/recovery action selected: Take a photo instead/)).toBeVisible();
});

test("non-provider read failures retain the generic unreadable state", async ({ page }) => {
  await page.addInitScript(() => {
    File.prototype.arrayBuffer = () => Promise.reject(new DOMException("generic read failure", "InvalidStateError"));
    FileReader.prototype.readAsArrayBuffer = function () {
      setTimeout(() => this.dispatchEvent(new ProgressEvent("error")), 0);
    };
  });
  await page.goto("/?debugUpload=1");
  await page.locator("#gallery-logo-input").setInputFiles(fixture("EC.png"));
  await expect(page.getByText("File unreadable", { exact: true })).toBeVisible();
  await expect(page.getByText("This photo could not be opened", { exact: true })).toHaveCount(0);
});

test("decoder failure remains separate from provider-handle recovery", async ({ page }) => {
  await page.addInitScript(() => {
    window.createImageBitmap = () => Promise.reject(new DOMException("bitmap unavailable", "NotSupportedError"));
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      set() {
        queueMicrotask(() => this.onerror?.(new Event("error")));
      },
    });
  });
  await page.goto("/");
  await page.locator("#gallery-logo-input").setInputFiles(fixture("EC.png"));
  await expect(page.getByText("Could not use image", { exact: true })).toBeVisible();
  await expect(page.getByText("This photo could not be opened", { exact: true })).toHaveCount(0);
});

test("focus returning before delayed Android change does not leave a watchdog warning", async ({ page }) => {
  await page.goto("/?debugUpload=1");
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText("Choose logo file", { exact: true }).click();
  const chooser = await chooserPromise;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(500);
  await chooser.setFiles(fixture("EC.png"));
  await expect(page.getByText(/upload state updated: accepted/)).toBeVisible();
  await page.waitForTimeout(1700);
  await expect(page.getByText(/Picker returned, but no file change event was received/)).toHaveCount(0);
  await expect(page.locator(".upload-error")).toHaveCount(0);
});

test("bitmap rejection uses the HTML decoder fallback and continues", async ({ page }) => {
  await page.addInitScript(() => {
    window.createImageBitmap = () => Promise.reject(new DOMException("forced bitmap failure", "NotSupportedError"));
  });
  await page.goto("/?debugUpload=1");
  await page.locator("#gallery-logo-input").setInputFiles(fixture("Xh'Aura.jpeg"));
  await expect(page.getByText(/HTMLImageElement fallback attempted/).first()).toBeVisible();
  await expect(page.getByText(/final route:/)).toBeVisible();
  await expect(page.getByText(/decode failed:/)).toHaveCount(0);
  await expect(page.getByText("This photo could not be opened", { exact: true })).toHaveCount(0);
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
  await expect(page.getByText(/final route:/)).toBeVisible();
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
  await page.getByText("Choose logo file", { exact: true }).click();
  await chooser;
  await page.waitForTimeout(600);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText(/Picker returned, but no file change event was received/)).toBeVisible({ timeout: 2500 });
  await expect(page.locator(".upload-error")).toHaveCount(0);
});
