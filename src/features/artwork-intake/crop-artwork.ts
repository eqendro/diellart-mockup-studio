import type {
  CropSelection,
  CroppedArtwork,
  DisplayRect,
  NormalisedCrop,
  PixelCropCoordinates,
} from "@/features/artwork-intake/workflow-types";
import type { AcceptedLogo } from "@/features/upload/types/logo-upload";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function mapCropToOriginal(
  crop: NormalisedCrop,
  originalWidth: number,
  originalHeight: number,
): PixelCropCoordinates {
  const x = clamp(crop.x, 0, 1);
  const y = clamp(crop.y, 0, 1);
  const width = clamp(crop.width, 0.01, 1 - x);
  const height = clamp(crop.height, 0.01, 1 - y);
  return {
    x: Math.round(x * originalWidth),
    y: Math.round(y * originalHeight),
    width: Math.max(1, Math.round(width * originalWidth)),
    height: Math.max(1, Math.round(height * originalHeight)),
  };
}

export function mapDisplayCropToNatural(
  displayCrop: DisplayRect,
  displayedImage: DisplayRect,
  naturalWidth: number,
  naturalHeight: number,
): PixelCropCoordinates {
  const relativeX = displayCrop.x - displayedImage.x;
  const relativeY = displayCrop.y - displayedImage.y;
  const normalisedX = clamp(relativeX / displayedImage.width, 0, 0.99);
  const normalisedY = clamp(relativeY / displayedImage.height, 0, 0.99);
  return {
    x: Math.round(normalisedX * naturalWidth),
    y: Math.round(normalisedY * naturalHeight),
    width: Math.max(
      1,
      Math.round(
        clamp(displayCrop.width / displayedImage.width, 0.01, 1 - normalisedX) *
          naturalWidth,
      ),
    ),
    height: Math.max(
      1,
      Math.round(
        clamp(displayCrop.height / displayedImage.height, 0.01, 1 - normalisedY) *
          naturalHeight,
      ),
    ),
  };
}

export async function createCroppedArtwork(
  logo: AcceptedLogo,
  selection: CropSelection,
): Promise<CroppedArtwork> {
  const bitmap = await createImageBitmap(logo.file);
  try {
    const coordinates = mapDisplayCropToNatural(
      selection.displayCrop,
      selection.displayedImage,
      bitmap.width,
      bitmap.height,
    );
    const canvas = document.createElement("canvas");
    canvas.width = coordinates.width;
    canvas.height = coordinates.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Cropping is unavailable.");
    context.drawImage(
      bitmap,
      coordinates.x,
      coordinates.y,
      coordinates.width,
      coordinates.height,
      0,
      0,
      coordinates.width,
      coordinates.height,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("Crop export failed."))),
        "image/png",
      ),
    );
    const file = new File([blob], `${logo.filename.replace(/\.[^.]+$/, "")}-crop.png`, {
      type: "image/png",
    });
    const croppedLogo = {
      ...logo,
      file,
      filename: file.name,
      mimeType: file.type,
      extension: "png",
      sizeBytes: file.size,
      formattedSize: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      width: coordinates.width,
      height: coordinates.height,
      aspectRatio: coordinates.width / coordinates.height,
      previewUrl: URL.createObjectURL(blob),
    };
    if (process.env.NODE_ENV !== "production") {
      console.debug("[artwork-crop]", logo.filename, {
        naturalSize: `${bitmap.width}×${bitmap.height}`,
        displayedSize: `${selection.displayedImage.width}×${selection.displayedImage.height}`,
        scaleX: bitmap.width / selection.displayedImage.width,
        scaleY: bitmap.height / selection.displayedImage.height,
        displayCrop: selection.displayCrop,
        naturalCrop: coordinates,
        canvasCreated: true,
        blobCreated: true,
        croppedObjectUrl: croppedLogo.previewUrl,
      });
    }
    return {
      logo: croppedLogo,
      crop: coordinates,
      objectUrl: croppedLogo.previewUrl,
    };
  } finally {
    bitmap.close();
  }
}
