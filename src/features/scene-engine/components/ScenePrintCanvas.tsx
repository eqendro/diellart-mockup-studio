"use client";

import { useEffect, useRef } from "react";
import type { PrintableArtwork } from "@/features/logo-engine/types/artwork";
import { projectPoint } from "@/features/scene-engine/geometry";
import type { ProjectedSceneArtwork, SceneDefinition } from "@/features/scene-engine/types";

type Props = { scene: SceneDefinition; artwork: PrintableArtwork; mapped: ProjectedSceneArtwork; width: number; height: number };

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

export function ScenePrintCanvas({ scene, artwork, mapped, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    canvas.dataset.ready = "false";
    let cancelled = false;
    Promise.all([loadImage(scene.asset.path), loadImage(artwork.url)]).then(([paper, ink]) => {
      if (cancelled) return;
      const outputWidth = Math.max(1, Math.round(width));
      const outputHeight = Math.max(1, Math.round(height));
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const paperCanvas = document.createElement("canvas");
      paperCanvas.width = outputWidth;
      paperCanvas.height = outputHeight;
      const paperContext = paperCanvas.getContext("2d", { willReadFrequently: true })!;
      paperContext.drawImage(paper, 0, 0, outputWidth, outputHeight);
      const paperPixels = paperContext.getImageData(0, 0, outputWidth, outputHeight);
      const inkCanvas = document.createElement("canvas");
      inkCanvas.width = artwork.canvasWidth;
      inkCanvas.height = artwork.canvasHeight;
      const inkContext = inkCanvas.getContext("2d", { willReadFrequently: true })!;
      inkContext.drawImage(ink, 0, 0, artwork.canvasWidth, artwork.canvasHeight);
      const inkPixels = inkContext.getImageData(0, 0, artwork.canvasWidth, artwork.canvasHeight);
      const output = new ImageData(outputWidth, outputHeight);
      const quad = mapped.projectedCanvasQuad;
      const minX = Math.max(0, Math.floor(Math.min(quad.topLeft.x, quad.topRight.x, quad.bottomRight.x, quad.bottomLeft.x)));
      const maxX = Math.min(outputWidth - 1, Math.ceil(Math.max(quad.topLeft.x, quad.topRight.x, quad.bottomRight.x, quad.bottomLeft.x)));
      const minY = Math.max(0, Math.floor(Math.min(quad.topLeft.y, quad.topRight.y, quad.bottomRight.y, quad.bottomLeft.y)));
      const maxY = Math.min(outputHeight - 1, Math.ceil(Math.max(quad.topLeft.y, quad.topRight.y, quad.bottomRight.y, quad.bottomLeft.y)));
      const substrateShare = scene.printMaterial.textureInfluence * 0.65;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const source = projectPoint(mapped.inverseProjection as Parameters<typeof projectPoint>[0], { x: x + 0.5, y: y + 0.5 });
        const sx = Math.floor(source.x - 0.5);
        const sy = Math.floor(source.y - 0.5);
        if (sx < 0 || sy < 0 || sx + 1 >= artwork.canvasWidth || sy + 1 >= artwork.canvasHeight) continue;
        const fractionX = source.x - 0.5 - sx;
        const fractionY = source.y - 0.5 - sy;
        const sample = (channel: number) => {
          const topLeft = inkPixels.data[(sy * artwork.canvasWidth + sx) * 4 + channel];
          const topRight = inkPixels.data[(sy * artwork.canvasWidth + sx + 1) * 4 + channel];
          const bottomLeft = inkPixels.data[((sy + 1) * artwork.canvasWidth + sx) * 4 + channel];
          const bottomRight = inkPixels.data[((sy + 1) * artwork.canvasWidth + sx + 1) * 4 + channel];
          return (topLeft * (1 - fractionX) + topRight * fractionX) * (1 - fractionY) +
            (bottomLeft * (1 - fractionX) + bottomRight * fractionX) * fractionY;
        };
        const alpha = sample(3) / 255;
        if (alpha <= 0) continue;
        const destinationOffset = (y * outputWidth + x) * 4;
        const paperLuminance = (paperPixels.data[destinationOffset] * 0.2126 + paperPixels.data[destinationOffset + 1] * 0.7152 + paperPixels.data[destinationOffset + 2] * 0.0722) / 255;
        const density = scene.printMaterial.density * (1 + scene.printMaterial.luminanceInfluence * (paperLuminance - 0.5));
        for (let channel = 0; channel < 3; channel++) {
          output.data[destinationOffset + channel] = clampByte(
            sample(channel) * density * (1 - substrateShare) +
            paperPixels.data[destinationOffset + channel] * substrateShare,
          );
        }
        output.data[destinationOffset + 3] = clampByte(alpha * scene.printMaterial.inkOpacity * 255);
      }
      canvas.getContext("2d")!.putImageData(output, 0, 0);
      canvas.dataset.ready = "true";
    });
    return () => { cancelled = true; };
  }, [artwork, height, mapped, scene, width]);

  return <canvas ref={canvasRef} className="scene-print-canvas" data-ready="false" aria-hidden="true" />;
}
