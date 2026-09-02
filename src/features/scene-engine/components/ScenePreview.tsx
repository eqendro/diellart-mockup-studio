"use client";

import { useEffect, useRef, useState } from "react";
import type { PrintableArtwork } from "@/features/logo-engine/types/artwork";
import type { ArtworkPlacement } from "@/features/mockup-engine/placement";
import { resolveSceneArtwork } from "@/features/scene-engine/geometry";
import { sceneText, type SceneLocale } from "@/features/scene-engine/localisation";
import type { SceneDefinition } from "@/features/scene-engine/types";

type ScenePreviewProps = {
  scene: SceneDefinition;
  artwork?: PrintableArtwork | null;
  placement: ArtworkPlacement;
  locale?: SceneLocale;
};

export function ScenePreview({ scene, artwork, placement, locale = "en" }: ScenePreviewProps) {
  const labels = sceneText(locale);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [assetFailed, setAssetFailed] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      setSize({ width: bounds.width, height: bounds.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const mapped = artwork
    ? resolveSceneArtwork(artwork, placement, scene, size.width, size.height)
    : null;
  const label = labels[scene.labelKey];

  return (
    <article
      className="scene-preview"
      data-scene-id={scene.id}
      data-printable-quad={JSON.stringify(scene.paperSurface)}
      data-surface-coordinates={scene.surfaceCoordinates}
      data-transform-matrix={mapped?.matrix3d}
      data-distortion={mapped ? JSON.stringify(mapped.distortion) : undefined}
      data-physical-bounds={mapped ? JSON.stringify(mapped.physicalBounds) : undefined}
      data-visible-physical-bounds={mapped ? JSON.stringify(mapped.visiblePhysicalBounds) : undefined}
    >
        <div
          ref={stageRef}
          className="scene-stage"
          style={{ aspectRatio: scene.canvas.aspectRatio }}
          role="img"
          aria-label={artwork ? `${label}: ${labels.yourDesign}` : `${label} ${labels.preview}`}
        >
          {!assetFailed ? (
            // Scene files can be replaced independently and are not optimised at runtime.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={scene.asset.path}
              alt=""
              className="scene-background"
              style={{ "--scene-desktop-position": scene.framing.desktopObjectPosition, "--scene-mobile-position": scene.framing.mobileObjectPosition } as React.CSSProperties}
              onError={() => setAssetFailed(true)}
            />
          ) : <span className="scene-fallback">{labels[scene.fallbackLabelKey]}</span>}
          {artwork && mapped ? (
            <div className="scene-surface" aria-hidden="true">
              {/* Blob URLs are browser-local and cannot use Next image optimisation. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artwork.url}
                alt=""
                className="scene-artwork"
                data-placement-scale={placement.scale}
                data-placement-rotation={placement.rotation}
                data-placement-offset-x={placement.offsetX}
                data-placement-offset-y={placement.offsetY}
                data-alpha-left={mapped.alphaBounds.x}
                data-alpha-top={mapped.alphaBounds.y}
                data-alpha-width={mapped.alphaBounds.width}
                data-alpha-height={mapped.alphaBounds.height}
                style={{
                  left: mapped.left,
                  top: mapped.top,
                  width: mapped.width,
                  height: mapped.height,
                  transform: mapped.matrix3d,
                  transformOrigin: "0 0",
                  opacity: scene.lighting.opacity * (1 - scene.paperTexture * 0.05),
                  mixBlendMode: artwork.veryLight ? "normal" : scene.lighting.blendMode,
                  filter: `brightness(${scene.lighting.brightness}) contrast(${scene.lighting.contrast}) saturate(${scene.lighting.saturation}) blur(${scene.lighting.blurPx}px)`,
                }}
              />
            </div>
          ) : null}
        </div>
    </article>
  );
}
