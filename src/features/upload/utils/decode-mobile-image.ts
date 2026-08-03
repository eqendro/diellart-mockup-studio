// Keeps common 3000 px exported artwork pixel-exact while bounding 12–48 MP
// phone photographs to roughly 41 MB of RGBA canvas memory.
export const MAX_WORKING_DIMENSION = 3200;

export type DecoderPath =
  | "createImageBitmap-options"
  | "createImageBitmap-plain"
  | "html-image-object-url"
  | "html-image-data-url";

export type DecodeStageReporter = (
  stage: string,
  detail?: string,
  status?: "ok" | "info" | "error",
) => void;

export type NormalisedImage = {
  blob: Blob;
  width: number;
  height: number;
  objectUrl: string;
  decoder: DecoderPath;
  orientation: "browser-decoded";
  resized: boolean;
};

type DecodeSource = {
  width: number;
  height: number;
  draw(context: CanvasRenderingContext2D, width: number, height: number): void;
  close(): void;
};

const describeError = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

export function calculateWorkingDimensions(width: number, height: number, maximum: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`ZERO_DIMENSION_IMAGE: ${width}×${height}`);
  }
  const scale = Math.min(1, maximum / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: scale < 1,
  };
}

async function loadBitmap(file: Blob, withOptions: boolean): Promise<DecodeSource> {
  if (typeof createImageBitmap !== "function") throw new Error("Bitmap decoder unavailable.");
  const bitmap = withOptions
    ? await createImageBitmap(file, { imageOrientation: "from-image" })
    : await createImageBitmap(file);
  return {
    width: bitmap.width,
    height: bitmap.height,
    draw: (context, width, height) => context.drawImage(bitmap, 0, 0, width, height),
    close: () => bitmap.close(),
  };
}

function waitForHtmlImage(
  sourceUrl: string,
  cleanup: () => void,
  onStage?: DecodeStageReporter,
): Promise<DecodeSource> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = async () => {
      onStage?.("img.onload result", `${image.naturalWidth}×${image.naturalHeight}`);
      if (!image.naturalWidth || !image.naturalHeight) {
        cleanup();
        reject(new Error("ZERO_DIMENSION_IMAGE: HTML image loaded without dimensions."));
        return;
      }
      if (typeof image.decode === "function") {
        try {
          await image.decode();
          onStage?.("img.decode result", "resolved");
        } catch (error) {
          // Samsung/Chrome can reject decode() even after a successful onload.
          onStage?.("img.decode result", `non-fatal rejection: ${describeError(error)}`, "info");
        }
      } else {
        onStage?.("img.decode result", "unavailable; onload used", "info");
      }
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
        draw: (context, width, height) => context.drawImage(image, 0, 0, width, height),
        close: cleanup,
      });
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("HTML_IMAGE_LOAD_ERROR: image.onerror fired."));
    };
    image.src = sourceUrl;
  });
}

function loadHtmlObjectUrl(file: Blob, onStage?: DecodeStageReporter) {
  const url = URL.createObjectURL(file);
  onStage?.("object URL created", url.slice(0, 48));
  return waitForHtmlImage(url, () => URL.revokeObjectURL(url), onStage);
}

function loadHtmlDataUrl(file: Blob, onStage?: DecodeStageReporter): Promise<DecodeSource> {
  onStage?.("FileReader fallback attempted", `${file.size} bytes`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FILE_READER_ERROR: JPEG could not be read."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("FILE_READER_ERROR: No data URL returned."));
        return;
      }
      void waitForHtmlImage(reader.result, () => undefined, onStage).then(resolve, reject);
    };
    reader.readAsDataURL(file);
  });
}

async function loadWithFallback(file: Blob, onStage?: DecodeStageReporter) {
  const failures: string[] = [];
  const attempts: Array<{
    path: DecoderPath;
    stage: string;
    load: () => Promise<DecodeSource>;
  }> = [
    {
      path: "createImageBitmap-options",
      stage: "createImageBitmap with options attempted",
      load: () => loadBitmap(file, true),
    },
    {
      path: "createImageBitmap-plain",
      stage: "plain createImageBitmap attempted",
      load: () => loadBitmap(file, false),
    },
    {
      path: "html-image-object-url",
      stage: "HTMLImageElement fallback attempted",
      load: () => loadHtmlObjectUrl(file, onStage),
    },
    {
      path: "html-image-data-url",
      stage: "data URL fallback attempted",
      load: () => loadHtmlDataUrl(file, onStage),
    },
  ];

  for (const attempt of attempts) {
    onStage?.(attempt.stage, attempt.path);
    try {
      const source = await attempt.load();
      onStage?.(`${attempt.path} result`, `${source.width}×${source.height}`);
      return { source, decoder: attempt.path };
    } catch (error) {
      const failure = `${attempt.path}: ${describeError(error)}`;
      failures.push(failure);
      onStage?.(`${attempt.path} failed`, describeError(error), "error");
    }
  }
  throw new Error(`ALL_DECODERS_FAILED: ${failures.join(" | ")}`);
}

function renderSource(
  source: DecodeSource,
  maximum: number,
  onStage?: DecodeStageReporter,
) {
  const dimensions = calculateWorkingDimensions(source.width, source.height, maximum);
  onStage?.("canvas size calculated", `${dimensions.width}×${dimensions.height}`);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  onStage?.("canvas created", `${canvas.width}×${canvas.height}`);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("CANVAS_CONTEXT_ERROR: 2D context unavailable.");
  try {
    source.draw(context, dimensions.width, dimensions.height);
    onStage?.("drawImage result", "success");
  } catch (error) {
    throw new Error(`DRAW_IMAGE_ERROR: ${describeError(error)}`);
  }
  try {
    context.getImageData(0, 0, 1, 1);
    onStage?.("getImageData result", "success");
  } catch (error) {
    throw new Error(`GET_IMAGE_DATA_ERROR: ${describeError(error)}`);
  }
  return { canvas, ...dimensions };
}

export async function decodeBlobToCanvas(
  file: Blob,
  options: { maxDimension?: number; onStage?: DecodeStageReporter } = {},
) {
  const { source, decoder } = await loadWithFallback(file, options.onStage);
  try {
    const maximum = options.maxDimension ?? Number.POSITIVE_INFINITY;
    try {
      return { ...renderSource(source, maximum, options.onStage), decoder };
    } catch (error) {
      const retryMaximum = Number.isFinite(maximum)
        ? Math.max(640, Math.floor(maximum / 2))
        : 1600;
      options.onStage?.("reduced-memory retry", `${retryMaximum}px after ${describeError(error)}`, "info");
      return { ...renderSource(source, retryMaximum, options.onStage), decoder };
    }
  } finally {
    // For object URLs this occurs only after load/decode/draw/getImageData.
    source.close();
    options.onStage?.("decoder source released", decoder);
  }
}

function exportCanvas(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("NORMALISED_EXPORT_ERROR: canvas.toBlob returned null.")),
      "image/png",
    ),
  );
}

export async function decodeMobileImage(
  file: Blob,
  options: { maxDimension?: number; onStage?: DecodeStageReporter } = {},
): Promise<NormalisedImage> {
  options.onStage?.("File received", `${file.type || "(no MIME)"}; ${file.size} bytes`);
  const maximum = options.maxDimension ?? MAX_WORKING_DIMENSION;
  let decoded = await decodeBlobToCanvas(file, { maxDimension: maximum, onStage: options.onStage });
  let blob: Blob;
  try {
    blob = await exportCanvas(decoded.canvas);
  } catch (error) {
    options.onStage?.("normalised export failed", describeError(error), "error");
    decoded.canvas.width = 1;
    decoded.canvas.height = 1;
    decoded = await decodeBlobToCanvas(file, {
      maxDimension: Math.max(640, Math.floor(maximum / 2)),
      onStage: options.onStage,
    });
    blob = await exportCanvas(decoded.canvas);
  }
  const objectUrl = URL.createObjectURL(blob);
  options.onStage?.("normalisation completed", `${decoded.width}×${decoded.height}; ${decoded.decoder}`);
  options.onStage?.("final success", decoded.decoder);
  return {
    blob,
    width: decoded.width,
    height: decoded.height,
    objectUrl,
    decoder: decoded.decoder,
    orientation: "browser-decoded",
    resized: decoded.resized,
  };
}
