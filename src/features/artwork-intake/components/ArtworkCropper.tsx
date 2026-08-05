"use client";

import { useRef, useState } from "react";
import ReactCrop, { type PercentCrop } from "react-image-crop";
import { Button } from "@/components/ui/Button";
import type { CropSelection } from "@/features/artwork-intake/workflow-types";

const initialCrop: PercentCrop = {
  unit: "%",
  x: 20,
  y: 20,
  width: 60,
  height: 60,
};

type ArtworkCropperProps = {
  imageUrl: string;
  filename: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (crop: CropSelection) => void;
};

export function ArtworkCropper({
  imageUrl,
  filename,
  busy = false,
  onCancel,
  onConfirm,
}: ArtworkCropperProps) {
  const [crop, setCrop] = useState<PercentCrop>(initialCrop);
  const imageRef = useRef<HTMLImageElement>(null);
  const reset = () => setCrop(initialCrop);
  return (
    <section className="crop-workflow" aria-labelledby="crop-heading">
      <header>
        <p className="text-eyebrow">Artwork selection</p>
        <h3 id="crop-heading" className="text-section-heading">Select your logo</h3>
        <p className="text-supporting">
          Adjust the box so it contains only the logo.
        </p>
      </header>
      <div className="crop-canvas">
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          keepSelection
          minWidth={44}
          minHeight={44}
          ariaLabels={{
            cropArea: "Selected logo area",
            nwDragHandle: "Resize selection from top left",
            nDragHandle: "Resize selection from top",
            neDragHandle: "Resize selection from top right",
            eDragHandle: "Resize selection from right",
            seDragHandle: "Resize selection from bottom right",
            sDragHandle: "Resize selection from bottom",
            swDragHandle: "Resize selection from bottom left",
            wDragHandle: "Resize selection from left",
          }}
        >
          {/* Browser-local object URL; uploaded SVG markup is not injected. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={imageUrl}
            alt={`Select the logo area in ${filename}`}
          />
        </ReactCrop>
      </div>
      <div className="crop-actions">
        <Button
          type="button"
          onClick={() =>
            imageRef.current &&
            onConfirm({
              normalised: {
                x: crop.x / 100,
                y: crop.y / 100,
                width: crop.width / 100,
                height: crop.height / 100,
              },
              displayCrop: {
                x: (crop.x / 100) * imageRef.current.getBoundingClientRect().width,
                y: (crop.y / 100) * imageRef.current.getBoundingClientRect().height,
                width: (crop.width / 100) * imageRef.current.getBoundingClientRect().width,
                height: (crop.height / 100) * imageRef.current.getBoundingClientRect().height,
              },
              displayedImage: {
                x: 0,
                y: 0,
                width: imageRef.current.getBoundingClientRect().width,
                height: imageRef.current.getBoundingClientRect().height,
              },
              naturalWidth: imageRef.current.naturalWidth,
              naturalHeight: imageRef.current.naturalHeight,
            })
          }
          loading={busy}
          loadingLabel="Preparing"
        >
          Continue
        </Button>
        <Button type="button" variant="secondary" onClick={reset} disabled={busy}>
          Reset
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Choose another image
        </Button>
      </div>
    </section>
  );
}
