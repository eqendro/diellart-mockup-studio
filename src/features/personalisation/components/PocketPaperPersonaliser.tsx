"use client";

import { useEffect, useRef, useState } from "react";
import { pocketPaperProductView } from "@/config/products/pocket-paper";
import { MockupRenderer } from "@/features/mockup-engine/components/MockupRenderer";
import {
  clampPlacement,
  calculatePlacementLimits,
  DEFAULT_PLACEMENT,
  resetPlacement,
  resizePlacement,
  rotatePlacement,
  type ArtworkPlacement,
} from "@/features/mockup-engine/placement";
import {
  useMonochromeArtwork,
  usePreparedArtwork,
} from "@/features/logo-engine";
import { ArtworkCropper } from "@/features/artwork-intake/components/ArtworkCropper";
import { AssistedExtraction } from "@/features/artwork-intake/components/AssistedExtraction";
import { LogoUpload } from "@/features/upload/components/LogoUpload";
import { useLogoUpload } from "@/features/upload/hooks/use-logo-upload";
import { ProofToolbar } from "@/features/personalisation/components/ProofToolbar";
import { PrintColourSelector } from "@/features/personalisation/components/PrintColourSelector";
import { ScenePreview } from "@/features/scene-engine/components/ScenePreview";
import { sceneText } from "@/features/scene-engine/localisation";
import { resolveSceneSelection, sceneCatalogue } from "@/features/scene-engine/registry";
import type { SceneId } from "@/features/scene-engine/types";

export function PocketPaperPersonaliser() {
  const labels = sceneText("sq");
  const upload = useLogoUpload();
  const preparation = usePreparedArtwork(upload.logo, upload.recordTrace);
  const monochrome = useMonochromeArtwork(preparation.printableArtwork);
  const [placement, setPlacement] = useState<ArtworkPlacement>(DEFAULT_PLACEMENT);
  const [selectedScene, setSelectedScene] = useState<SceneId>("product-view");
  const [interactedArtworkUrl, setInteractedArtworkUrl] = useState<string | null>(
    null,
  );
  const activeScene = resolveSceneSelection(selectedScene, "product-view");
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preparation.customerState.status === "preview-ready") {
      workspaceRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  }, [preparation.customerState.status]);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      preparation.printableArtwork &&
      preparation.selectedArtworkUrl
    ) {
      console.assert(
        preparation.printableArtwork.url === preparation.selectedArtworkUrl,
        "Checkerboard selection and renderer must use the same artwork URL.",
      );
    }
  }, [preparation.printableArtwork, preparation.selectedArtworkUrl]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !upload.logo) return;
    const bounds = workspaceRef.current
      ?.querySelector<HTMLElement>(".proof-stage")
      ?.getBoundingClientRect();
    console.debug("[renderer-contract]", {
      filename: upload.logo.filename,
      customerState: preparation.customerState.status,
      selectedArtworkUrl: preparation.selectedArtworkUrl,
      rendererArtworkUrl: preparation.printableArtwork?.url ?? null,
      productImageUrl: pocketPaperProductView.imagePath,
      rendererMounted: Boolean(
        workspaceRef.current?.querySelector(".mockup-stage"),
      ),
      proofWidth: bounds?.width ?? 0,
      proofHeight: bounds?.height ?? 0,
    });
    console.assert(
      Boolean(pocketPaperProductView.imagePath),
      "Pocket Paper master-image URL is required.",
    );
    console.assert(
      (bounds?.width ?? 0) > 0 && (bounds?.height ?? 0) > 0,
      "Proof container must have non-zero dimensions.",
    );
    if (preparation.customerState.status === "preview-ready") {
      console.assert(
        Boolean(preparation.selectedArtworkUrl),
        "preview-ready requires a selected artwork URL.",
      );
    }
  }, [
    preparation.customerState.status,
    preparation.printableArtwork,
    preparation.selectedArtworkUrl,
    upload.logo,
  ]);

  useEffect(() => {
    // Artwork identity/version changes intentionally invalidate manual placement.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlacement(resetPlacement());
  }, [upload.logo, preparation.selectedArtworkUrl]);

  const updatePlacement = (next: ArtworkPlacement) => {
    const limits = preparation.printableArtwork
      ? calculatePlacementLimits(next.scale, {
          mockup: pocketPaperProductView,
          artworkAspectRatio: preparation.printableArtwork.aspectRatio,
          rotation: next.rotation,
        })
      : calculatePlacementLimits(next.scale);
    setPlacement(clampPlacement(next, limits));
  };

  const changePrintColour = (selection: Parameters<typeof monochrome.setSelection>[0]) => {
    monochrome.setSelection(selection);
  };

  const resizeArtwork = (direction: "increase" | "decrease") => {
    setPlacement((current) => resizePlacement(current, direction, {
      mockup: pocketPaperProductView,
      artworkAspectRatio: preparation.printableArtwork?.aspectRatio ?? 1,
    }));
  };

  const rotateArtwork = (direction: "clockwise" | "anticlockwise") => {
    setPlacement((current) => rotatePlacement(
      current,
      current.rotation + (direction === "clockwise" ? 2 : -2),
      {
        mockup: pocketPaperProductView,
        artworkAspectRatio: preparation.printableArtwork?.aspectRatio ?? 1,
      },
    ));
  };

  const selectScene = (sceneId: SceneId) => {
    setSelectedScene(sceneId);
    requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  };

  return (
    <>
      {!upload.logo ? (
        <section className="hero" aria-labelledby="hero-heading">
          <div className="container hero-grid">
            <div className="hero-content">
              <p className="text-eyebrow hero-eyebrow">Nga ideja, te produkti</p>
              <h1 id="hero-heading" className="text-display">
                Visualizo markën
                <span>para se ta printosh.</span>
              </h1>
              <p className="text-body hero-description">
                Ngarko logon tënde dhe shikoje në produktet DiellART përpara
                se të nisë prodhimi.
              </p>
              <a className="hero-cta" href="#logo-upload">
                <span>Shijo ndjesinë</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h13m-5-5 5 5-5 5" />
                </svg>
              </a>
              <p className="hero-privacy">
                <span aria-hidden="true" /> Përpunim privat në shfletuesin tënd
              </p>
            </div>
            <div className="hero-upload">
              <div className="hero-upload-heading">
                <p className="text-eyebrow">Studio e markës</p>
                <p>Logoja jote nis këtu.</p>
              </div>
              <LogoUpload upload={upload} />
            </div>
          </div>
        </section>
      ) : preparation.cropOpen ? (
        <div ref={workspaceRef} className="container crop-workspace-full">
          <ArtworkCropper
            imageUrl={upload.logo.previewUrl}
            filename={upload.logo.filename}
            busy={preparation.processingCrop}
            onCancel={preparation.cancelCrop}
            onConfirm={(crop) => {
              setPlacement(resetPlacement());
              void preparation.confirmCrop(crop);
            }}
          />
        </div>
      ) : (
        <section ref={workspaceRef} className="studio-section" aria-labelledby="proof-heading" data-active-scene={activeScene.id}>
          <div className="container studio-shell">
          {preparation.croppedArtwork &&
          (preparation.customerState.status === "select-logo-area" ||
            preparation.customerState.status === "review-extraction") ? (
            <AssistedExtraction
              candidates={preparation.extractionCandidates}
              message={preparation.extractionMessage}
              onAccept={preparation.acceptExtraction}
              onAdjust={preparation.requestCrop}
              onReplace={upload.removeLogo}
            />
          ) : null}
          {!(preparation.customerState.status === "review-extraction" && preparation.extractionCandidates.length === 0) ? (
          <>
            <header className="studio-heading">
              <div>
                <p className="text-eyebrow">Studio digjitale</p>
                <h2 id="proof-heading" className="text-section-heading">
                  Marka jote, në produkt.
                </h2>
                <p className="proof-product-name">Pocket Paper · Parapamje reale para prodhimit</p>
              </div>
              {activeScene.category === "product" ? <ProofToolbar upload={upload} /> : null}
            </header>
            {preparation.customerState.status === "select-logo-area" &&
            !preparation.croppedArtwork ? (
              <div className="proof-help">
                <div>
                  <p className="text-card-heading">
                    We need a little help finding your logo.
                  </p>
                  <p className="text-supporting">
                    Select the area that contains only your logo.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-primary button-medium"
                  onClick={preparation.requestCrop}
                >
                  Select logo area
                </button>
              </div>
            ) : null}
            <div className="studio-viewer">
              <div className={`studio-preview-frame ${activeScene.category === "product" ? "studio-product-frame" : "studio-lifestyle-frame"}`} aria-live="polite">
                {activeScene.category === "product" ? (
                  <div className="proof-stage">
                    <MockupRenderer
                      mockup={pocketPaperProductView}
                      artwork={preparation.customerState.status === "preview-ready" && monochrome.status === "ready" ? monochrome.artwork : null}
                      placement={placement}
                      onPlacementCommit={updatePlacement}
                      onInteractionComplete={(pointerType) => {
                        if (pointerType === "touch") setInteractedArtworkUrl(upload.logo?.previewUrl ?? null);
                      }}
                    />
                    {preparation.customerState.status === "analysing" ? (
                      <div className="customer-status" role="status">Duke gjetur logon…</div>
                    ) : preparation.customerState.status === "preparing" ? (
                      <div className="customer-status" role="status">Duke përgatitur parapamjen…</div>
                    ) : preparation.customerState.status === "preview-ready" && monochrome.status !== "ready" ? (
                      <div className="customer-status" role="status">Duke përgatitur printimin njëngjyrësh…</div>
                    ) : preparation.customerState.status === "error-recoverable" ? (
                      <LogoUpload upload={upload} preparation={preparation} recoveryOnly />
                    ) : preparation.customerState.status === "preview-ready" && !preparation.printableArtwork ? (
                      <div className="customer-status" role="status">Zgjidh zonën e logos për të vazhduar.</div>
                    ) : null}
                  </div>
                ) : (
                  <ScenePreview
                    key={activeScene.id}
                    scene={activeScene}
                    artwork={preparation.customerState.status === "preview-ready" && monochrome.status === "ready" ? monochrome.artwork : null}
                    placement={placement}
                  />
                )}
              </div>
              <aside className="studio-rail">
                <div className="studio-scenes-group">
                  <p className="studio-rail-label">Pamjet</p>
                  <nav className="studio-scene-selector" aria-label={labels.lifestylePreviews}>
                    {sceneCatalogue.map((scene) => (
                      <button
                        key={scene.id}
                        type="button"
                        className="studio-scene-option"
                        aria-pressed={activeScene.id === scene.id}
                        onClick={() => selectScene(scene.id)}
                      >
                        <span>{labels[scene.labelKey]}</span>
                        <span className="studio-scene-dot" aria-hidden="true" />
                      </button>
                    ))}
                  </nav>
                </div>
                {preparation.customerState.status === "preview-ready" ? (
                  <div className={`studio-controls ${activeScene.category === "lifestyle" ? "studio-controls-lifestyle" : ""}`} aria-label="Kontrollet e dizajnit">
                    <p className="studio-rail-label">Ngjyra e printimit</p>
                    <PrintColourSelector compact detectedColour={monochrome.detectedColour} selection={monochrome.selection} onChange={changePrintColour} />
                    {activeScene.category === "product" ? (
                      <>
                        <fieldset className="studio-compact-control">
                          <legend>Madhësia</legend>
                          <button type="button" className="precision-button" aria-label="Make artwork smaller" onClick={() => resizeArtwork("decrease")}>−</button>
                          <button type="button" className="precision-button" aria-label="Make artwork larger" onClick={() => resizeArtwork("increase")}>+</button>
                        </fieldset>
                        <fieldset className="studio-compact-control">
                          <legend>Rrotullimi</legend>
                          <button type="button" className="precision-button" aria-label="Rotate artwork anticlockwise" onClick={() => rotateArtwork("anticlockwise")}>↶</button>
                          <button type="button" className="precision-button" aria-label="Rotate artwork clockwise" onClick={() => rotateArtwork("clockwise")}>↷</button>
                        </fieldset>
                        <button type="button" className="button button-ghost button-medium studio-reset" onClick={() => setPlacement(resetPlacement())}>Rivendos</button>
                      </>
                    ) : null}
                  </div>
                ) : null}
                <a className="studio-contact-cta" href="#contact"><span>Na kontakto</span><span aria-hidden="true">→</span></a>
              </aside>
            </div>
            {activeScene.category === "product" && preparation.customerState.status === "preview-ready" && interactedArtworkUrl !== upload.logo?.previewUrl ? (
              <p className="gesture-instruction">Tërhiq për ta lëvizur <span aria-hidden="true">·</span> afro gishtat për madhësi</p>
            ) : null}
            <div className="studio-footer-row">
              <p className="proof-disclaimer">Parapamja tregon printimin e zgjedhur njëngjyrësh. Materiali final përgatitet profesionalisht para prodhimit.</p>
            </div>
          </>
          ) : null}
          </div>
        </section>
      )}
    </>
  );
}
