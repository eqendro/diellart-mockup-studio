import type { AcceptedLogo } from "@/features/upload/types/logo-upload";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

export function readImageDimensions(
  previewUrl: string,
  isSvg: boolean,
): Promise<Pick<AcceptedLogo, "width" | "height" | "aspectRatio">> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth || null;
      const height = image.naturalHeight || null;

      if ((!width || !height) && !isSvg) {
        reject(new Error("Raster image has no readable dimensions."));
        return;
      }

      // Browsers commonly report 300×150 when an SVG has no intrinsic size.
      // Treat that ambiguous fallback as unspecified instead of presenting it
      // as verified artwork metadata.
      const usesSvgFallbackSize = isSvg && width === 300 && height === 150;
      const resolvedWidth = usesSvgFallbackSize ? null : width;
      const resolvedHeight = usesSvgFallbackSize ? null : height;

      resolve({
        width: resolvedWidth,
        height: resolvedHeight,
        aspectRatio:
          resolvedWidth && resolvedHeight
            ? resolvedWidth / resolvedHeight
            : null,
      });
    };

    image.onerror = () => {
      reject(new Error("Image decoding failed."));
    };

    image.src = previewUrl;
  });
}

export function formatAspectRatio(aspectRatio: number | null): string {
  if (!aspectRatio) {
    return "Not specified";
  }

  return `${aspectRatio.toFixed(2)}:1`;
}
