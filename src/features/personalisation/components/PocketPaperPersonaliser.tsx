"use client";

import { useEffect, useRef, useState } from "react";
import { PreviewCard } from "@/components/ui/PreviewCard";
import { pocketPaperProductView } from "@/config/products/pocket-paper";
import { MockupRenderer } from "@/features/mockup-engine/components/MockupRenderer";
import {
  clampPlacement,
  calculatePlacementLimits,
  centrePlacement,
  DEFAULT_PLACEMENT,
  resetPlacement,
  movePlacement,
  type ArtworkPlacement,
} from "@/features/mockup-engine/placement";
import {
  useMonochromeArtwork,
  usePreparedArtwork,
} from "@/features/logo-engine";
import { ArtworkCropper } from "@/features/artwork-intake/components/ArtworkCropper";
import { LogoUpload } from "@/features/upload/components/LogoUpload";
import { useLogoUpload } from "@/features/upload/hooks/use-logo-upload";
import { ProofToolbar } from "@/features/personalisation/components/ProofToolbar";
import { PrintColourSelector } from "@/features/personalisation/components/PrintColourSelector";

const scenePreviews = [
  {
    title: "Main Dish Setting",
    description: "See your branding presented in a refined table setting.",
    variant: "main" as const,
  },
  {
    title: "Dessert Setting",
    description: "Preview the details in a lighter finishing-course scene.",
    variant: "dessert" as const,
  },
];

export function PocketPaperPersonaliser() {
  const upload = useLogoUpload();
  const preparation = usePreparedArtwork(upload.logo);
  const monochrome = useMonochromeArtwork(preparation.printableArtwork);
  const [placement, setPlacement] = useState<ArtworkPlacement>(DEFAULT_PLACEMENT);
  const [interactedArtworkUrl, setInteractedArtworkUrl] = useState<string | null>(
    null,
  );
  const [finalProof, setFinalProof] = useState<{
    artworkUrl: string;
    printColour: string;
    productId: string;
    placement: ArtworkPlacement;
  } | null>(null);
  const placementLimits = preparation.printableArtwork
    ? calculatePlacementLimits(placement.scale, {
        mockup: pocketPaperProductView,
        artworkAspectRatio: preparation.printableArtwork.aspectRatio,
      })
    : calculatePlacementLimits(placement.scale);
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (upload.logo) {
      workspaceRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [upload.logo]);

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
    setFinalProof(null);
  }, [upload.logo, preparation.selectedArtworkUrl]);

  const updatePlacement = (next: ArtworkPlacement) => {
    const limits = preparation.printableArtwork
      ? calculatePlacementLimits(next.scale, {
          mockup: pocketPaperProductView,
          artworkAspectRatio: preparation.printableArtwork.aspectRatio,
        })
      : calculatePlacementLimits(next.scale);
    setPlacement(clampPlacement(next, limits));
  };

  return (
    <>
      {!upload.logo ? (
        <div className="container personaliser-upload">
          <LogoUpload upload={upload} />
        </div>
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
        <div ref={workspaceRef} className="container proof-workspace">
          <section className="proof-main" aria-labelledby="proof-heading">
            <header className="proof-heading">
              <div>
                <p className="text-eyebrow">Digital proof</p>
                <h2 id="proof-heading" className="text-section-heading">
                  Your Design Preview
                </h2>
                <p className="proof-product-name">Product: Pocket Paper</p>
              </div>
              <ProofToolbar upload={upload} />
            </header>
            {preparation.customerState.status === "select-logo-area" ? (
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
            {preparation.customerState.status === "preview-ready" ? (
              <div className="mobile-print-colour">
                <PrintColourSelector
                  compact
                  detectedColour={monochrome.detectedColour}
                  selection={monochrome.selection}
                  onChange={(selection) => {
                    monochrome.setSelection(selection);
                    setFinalProof(null);
                  }}
                />
              </div>
            ) : null}
            <div className="proof-stage">
              <MockupRenderer
                mockup={pocketPaperProductView}
                artwork={
                  preparation.customerState.status === "preview-ready" &&
                  monochrome.status === "ready"
                    ? monochrome.artwork
                    : null
                }
                placement={placement}
                onPlacementCommit={updatePlacement}
                onInteractionComplete={(pointerType) => {
                  if (pointerType === "touch") {
                    setInteractedArtworkUrl(upload.logo?.previewUrl ?? null);
                  }
                }}
              />
              {preparation.customerState.status === "analysing" ? (
                <div className="customer-status" role="status">Finding your logo…</div>
              ) : preparation.customerState.status === "preparing" ? (
                <div className="customer-status" role="status">Preparing your preview…</div>
              ) : preparation.customerState.status === "preview-ready" &&
                monochrome.status !== "ready" ? (
                <div className="customer-status" role="status">
                  Preparing one-colour artwork…
                </div>
              ) : preparation.customerState.status === "error-recoverable" ? (
                <LogoUpload
                  upload={upload}
                  preparation={preparation}
                  recoveryOnly
                />
              ) : preparation.customerState.status === "preview-ready" &&
                !preparation.printableArtwork ? (
                <div className="customer-status" role="status">
                  Select the logo area to continue.
                </div>
              ) : null}
            </div>
            {preparation.customerState.status === "preview-ready" &&
            interactedArtworkUrl !== upload.logo?.previewUrl ? (
              <p className="gesture-instruction">
                Drag to move <span aria-hidden="true">·</span> Pinch to resize
              </p>
            ) : null}
            <p className="proof-disclaimer">
              This digital proof shows the selected one-colour print appearance.
              Final production artwork will be professionally prepared before printing.
            </p>
          </section>
          {preparation.customerState.status === "preview-ready" ? (
          <aside
            className="proof-sidebar"
            aria-label="Artwork controls"
            data-approved-print-colour={finalProof?.printColour}
            data-approved-product={finalProof?.productId}
          >
            <div className="desktop-print-colour">
              <PrintColourSelector
                detectedColour={monochrome.detectedColour}
                selection={monochrome.selection}
                onChange={(selection) => {
                  monochrome.setSelection(selection);
                  setFinalProof(null);
                }}
              />
            </div>
            <LogoUpload
              upload={upload}
              preparation={preparation}
              simplified
              hideAssetActions
              approved={Boolean(finalProof)}
              placement={placement}
              placementLimits={placementLimits}
              onPlacementChange={updatePlacement}
              onMovePlacement={(direction) =>
                setPlacement((current) =>
                  movePlacement(current, direction, placementLimits),
                )
              }
              onCentrePlacement={() =>
                setPlacement((current) => centrePlacement(current))
              }
              onResetPlacement={() => setPlacement(resetPlacement())}
              onArtworkVersionChange={(showOriginal) => {
                preparation.setShowOriginal(showOriginal);
                setPlacement(resetPlacement());
              }}
              onApprove={() => {
                if (monochrome.artwork) {
                  setFinalProof({
                    artworkUrl: monochrome.artwork.url,
                    printColour: monochrome.selectedColour,
                    productId: pocketPaperProductView.id,
                    placement: { ...placement },
                  });
                }
              }}
              onEditPlacement={() => setFinalProof(null)}
            />
          </aside>
          ) : null}
        </div>
      )}
      {!preparation.cropOpen ? <div className="container lifestyle-section">
        <header className="section-header">
          <p className="text-eyebrow">Lifestyle previews</p>
          <h2 id="preview-heading" className="text-section-heading">
            Your product, thoughtfully presented.
          </h2>
          <p className="text-body">
            Product View is personalised in your browser. The table-setting
            scenes will follow in a later stage.
          </p>
        </header>
        <div className="preview-grid">
          {!upload.logo ? (
            <PreviewCard
              title="Product View"
              description="Upload a logo to create your personalised Pocket Paper preview."
              variant="product"
            />
          ) : null}
          {scenePreviews.map((preview) => (
            <PreviewCard key={preview.title} {...preview} />
          ))}
        </div>
      </div> : null}
    </>
  );
}
