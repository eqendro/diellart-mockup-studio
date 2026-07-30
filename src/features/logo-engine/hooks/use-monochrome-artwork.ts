"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PRINT_COLOURS,
  type PrintColourKey,
} from "@/features/logo-engine/monochrome/config";
import {
  createMonochromePixels,
  detectDominantBrandColour,
  type DetectedBrandColour,
  type RasterPixels,
} from "@/features/logo-engine/monochrome/pixels";
import type { PrintableArtwork } from "@/features/logo-engine/types/artwork";
import { cleanupResidualNoise } from "@/features/logo-engine/preparation/residual-noise-cleanup";

type MonochromeSource = {
  artworkUrl: string;
  pixels: RasterPixels;
  detection: DetectedBrandColour;
  blobs: Map<string, Blob>;
};

async function decodeArtwork(url: string): Promise<RasterPixels> {
  const blob = await fetch(url).then((response) => response.blob());
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Monochrome canvas is unavailable.");
    context.drawImage(bitmap, 0, 0);
    const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return {
      data: new Uint8ClampedArray(image.data),
      width: image.width,
      height: image.height,
    };
  } finally {
    bitmap.close();
  }
}

async function createMonochromeBlob(pixels: RasterPixels, colour: string) {
  const monochrome = createMonochromePixels(pixels, colour);
  const cleanup = cleanupResidualNoise(monochrome);
  const cleaned = cleanup.image;
  if (process.env.NODE_ENV !== "production" && cleanup.changed) {
    console.debug("[artwork-residual-noise]", cleanup.diagnostics);
  }
  const canvas = document.createElement("canvas");
  canvas.width = cleaned.width;
  canvas.height = cleaned.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Monochrome canvas is unavailable.");
  const output = new ImageData(cleaned.width, cleaned.height);
  output.data.set(cleaned.data);
  context.putImageData(output, 0, 0);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Monochrome export failed."))),
      "image/png",
    ),
  );
}

export function useMonochromeArtwork(artwork: PrintableArtwork | null) {
  const [source, setSource] = useState<MonochromeSource | null>(null);
  const [selection, setSelection] = useState<PrintColourKey>("black");
  const [monochromeArtwork, setMonochromeArtwork] =
    useState<PrintableArtwork | null>(null);
  const [status, setStatus] = useState<"idle" | "analysing" | "ready" | "error">(
    "idle",
  );
  const activeUrlRef = useRef<string | null>(null);
  const sourceGenerationRef = useRef(0);
  const colourGenerationRef = useRef(0);

  const revokeActiveUrl = () => {
    if (!activeUrlRef.current) return;
    URL.revokeObjectURL(activeUrlRef.current);
    activeUrlRef.current = null;
  };

  useEffect(() => {
    const generation = ++sourceGenerationRef.current;
    colourGenerationRef.current++;
    revokeActiveUrl();
    // A new prepared source invalidates every derived monochrome candidate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonochromeArtwork(null);
    setSource(null);
    if (!artwork) {
      setStatus("idle");
      return;
    }
    setStatus("analysing");
    void decodeArtwork(artwork.url)
      .then((pixels) => {
        if (generation !== sourceGenerationRef.current) return;
        if (process.env.NODE_ENV !== "production") {
          console.assert(
            pixels.width === artwork.canvasWidth &&
              pixels.height === artwork.canvasHeight,
            "Monochrome input dimensions must match prepared artwork dimensions.",
          );
        }
        const detection = detectDominantBrandColour(pixels);
        setSelection(detection.confident ? "brand" : "black");
        setSource({
          artworkUrl: artwork.url,
          pixels,
          detection,
          blobs: new Map(),
        });
      })
      .catch(() => {
        if (generation === sourceGenerationRef.current) setStatus("error");
      });
  }, [artwork]);

  const selectedColour = useMemo(() => {
    if (selection === "brand") return source?.detection.hex ?? PRINT_COLOURS.black;
    return PRINT_COLOURS[selection];
  }, [selection, source]);

  useEffect(() => {
    if (!artwork || !source || source.artworkUrl !== artwork.url) return;
    const generation = ++colourGenerationRef.current;
    // Do not render the previous colour while its replacement is generated.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("analysing");
    setMonochromeArtwork(null);
    const cached = source.blobs.get(selectedColour);
    const blobPromise = cached
      ? Promise.resolve(cached)
      : createMonochromeBlob(source.pixels, selectedColour).then((blob) => {
          source.blobs.set(selectedColour, blob);
          return blob;
        });
    void blobPromise
      .then((blob) => {
        if (generation !== colourGenerationRef.current) return;
        const url = URL.createObjectURL(blob);
        revokeActiveUrl();
        activeUrlRef.current = url;
        setMonochromeArtwork({
          ...artwork,
          url,
          veryLight: false,
        });
        setStatus("ready");
        if (process.env.NODE_ENV !== "production") {
          console.debug("[monochrome-artwork]", {
            sourceUrl: artwork.url,
            monochromeUrl: url,
            detectedColour: source.detection.hex,
            detectionConfident: source.detection.confident,
            selectedColour,
          });
        }
      })
      .catch(() => {
        if (generation === colourGenerationRef.current) setStatus("error");
      });
  }, [artwork, selectedColour, source]);

  useEffect(
    () => () => {
      sourceGenerationRef.current++;
      colourGenerationRef.current++;
      revokeActiveUrl();
    },
    [],
  );

  return {
    artwork: monochromeArtwork,
    status,
    selection,
    setSelection,
    selectedColour,
    detectedColour: source?.detection.hex ?? PRINT_COLOURS.black,
    detectionConfident: source?.detection.confident ?? false,
  };
}
