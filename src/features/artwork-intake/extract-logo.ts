import { detectForegroundBounds, type PixelImage } from "@/features/logo-engine/preparation/process-pixels";
import type { AcceptedLogo } from "@/features/upload/types/logo-upload";
import { decodeBlobToCanvas } from "@/features/upload/utils/decode-mobile-image";

export type ExtractionMode = "dark-on-light" | "light-on-dark" | "selected-colour" | "selected-background";
export type Rgb = readonly [number, number, number];

const distance = (data: Uint8ClampedArray, offset: number, colour: Rgb) =>
  Math.hypot(data[offset] - colour[0], data[offset + 1] - colour[1], data[offset + 2] - colour[2]);

export function extractLogoPixels(
  input: PixelImage,
  mode: ExtractionMode,
  selected: Rgb = [0, 0, 0],
): PixelImage {
  const data = new Uint8ClampedArray(input.data);
  for (let offset = 0; offset < data.length; offset += 4) {
    const luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
    let strength: number;
    if (mode === "dark-on-light") strength = (190 - luminance) / 90;
    else if (mode === "light-on-dark") strength = (luminance - 65) / 110;
    else if (mode === "selected-colour") strength = (95 - distance(data, offset, selected)) / 55;
    else strength = (distance(data, offset, selected) - 30) / 70;
    data[offset + 3] = Math.round(255 * Math.max(0, Math.min(1, strength)));
  }
  return { data, width: input.width, height: input.height };
}

export function validateExtractedLogo(image: PixelImage) {
  let foreground = 0;
  for (let offset = 3; offset < image.data.length; offset += 4) {
    if (image.data[offset] > 20) foreground++;
  }
  const foregroundRatio = foreground / (image.width * image.height);
  const bounds = detectForegroundBounds(image, 20);
  const boundsRatio = bounds ? (bounds.width * bounds.height) / (image.width * image.height) : 0;
  const valid = Boolean(bounds) && foregroundRatio >= 0.002 && foregroundRatio < 0.88 &&
    !(foregroundRatio > 0.72 && boundsRatio > 0.94);
  return {
    valid,
    foregroundRatio,
    bounds,
    reason: valid ? null : "The selected area still looks like a filled rectangle.",
  };
}

export async function createExtractedLogo(
  logo: AcceptedLogo,
  mode: ExtractionMode,
  selected?: Rgb,
) {
  if (!logo.normalisedBlob) throw new Error("NORMALISED_IMAGE_REQUIRED: extraction cannot decode the original upload.");
  const bitmap = await decodeBlobToCanvas(logo.normalisedBlob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Logo separation is unavailable.");
    context.drawImage(bitmap.canvas, 0, 0);
    const extracted = extractLogoPixels(context.getImageData(0, 0, bitmap.width, bitmap.height), mode, selected);
    const validation = validateExtractedLogo(extracted);
    const output = context.createImageData(extracted.width, extracted.height);
    output.data.set(extracted.data);
    context.putImageData(output, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Logo preview export failed.")), "image/png"),
    );
    return { blob, validation };
}
