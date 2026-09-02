"use client";

import { useState } from "react";
import type { PrintableArtwork } from "@/features/logo-engine/types/artwork";
import type { ArtworkPlacement } from "@/features/mockup-engine/placement";
import { resolveSceneSelection, sceneCatalogue } from "@/features/scene-engine/registry";
import { ScenePreview } from "@/features/scene-engine/components/ScenePreview";
import { sceneText } from "@/features/scene-engine/localisation";
import type { SceneId } from "@/features/scene-engine/types";

export function SceneGallery({ artwork, placement }: { artwork?: PrintableArtwork | null; placement: ArtworkPlacement }) {
  const [selectedScene, setSelectedScene] = useState<SceneId>("main-dish");
  const labels = sceneText("en");
  const activeScene = resolveSceneSelection(selectedScene, "main-dish");
  return (
    <div className="scene-gallery" data-active-scene={selectedScene}>
      <div className="scene-selector" role="group" aria-label={labels.lifestylePreviews}>
        {sceneCatalogue.map((scene) => (
          <button
            key={scene.id}
            type="button"
            className="scene-selector-option"
            aria-pressed={scene.category === "lifestyle" && selectedScene === scene.id}
            onClick={() => {
              if (scene.category === "product") {
                document.querySelector(".proof-main")?.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
              }
              setSelectedScene(scene.id);
            }}
          >
            {labels[scene.labelKey]}
          </button>
        ))}
      </div>
      <div className="scene-preview-frame" aria-live="polite">
        <ScenePreview key={activeScene.id} scene={activeScene} artwork={artwork} placement={placement} />
      </div>
    </div>
  );
}
