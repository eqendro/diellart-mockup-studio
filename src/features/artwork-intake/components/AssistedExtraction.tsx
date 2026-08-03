"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ExtractionMode } from "@/features/artwork-intake";

type Props = {
  cropUrl: string;
  extractedUrl?: string | null;
  reviewing: boolean;
  mode: ExtractionMode;
  message?: string | null;
  onMode: (mode: ExtractionMode, selected?: readonly [number, number, number]) => void;
  onAccept: () => void;
  onAdjust: () => void;
};

export function AssistedExtraction({
  cropUrl,
  extractedUrl,
  reviewing,
  mode,
  message,
  onMode,
  onAccept,
  onAdjust,
}: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [tapMode, setTapMode] = useState<"selected-colour" | "selected-background" | null>(null);
  const sample = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!tapMode || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    canvas.width = imageRef.current.naturalWidth;
    canvas.height = imageRef.current.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(imageRef.current, 0, 0);
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((event.clientX - rect.left) / rect.width * canvas.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((event.clientY - rect.top) / rect.height * canvas.height)));
    const pixel = context.getImageData(x, y, 1, 1).data;
    onMode(tapMode, [pixel[0], pixel[1], pixel[2]]);
    setTapMode(null);
  };
  return (
    <section className="assisted-extraction" aria-labelledby="separate-logo-heading">
      <header>
        <p className="text-eyebrow">Logo separation</p>
        <h3 id="separate-logo-heading" className="text-section-heading">
          Help us separate the logo
        </h3>
        <p className="text-supporting">
          Choose the option that best matches the lettering or mark.
        </p>
      </header>
      <div className="candidate-previews">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={cropUrl}
            alt="Selected logo area"
            onClick={sample}
            className={tapMode ? "colour-sampling-image" : undefined}
          />
          <figcaption>Selected area</figcaption>
        </figure>
        <figure className="transparent-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {extractedUrl ? <img src={extractedUrl} alt="Extracted logo preview" /> : null}
          <figcaption>Extracted logo</figcaption>
        </figure>
      </div>
      {message ? <p className="upload-warning" role="status">{message} Try another option or adjust the box.</p> : null}
      <div className="crop-actions">
        <Button type="button" variant="secondary" onClick={() => onMode("dark-on-light")}>
          Dark logo on light
        </Button>
        <Button type="button" variant="secondary" onClick={() => onMode("light-on-dark")}>
          Light logo on dark
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onMode(mode === "light-on-dark" ? "dark-on-light" : "light-on-dark")}
        >
          Try the opposite
        </Button>
        <Button type="button" variant="secondary" onClick={() => setTapMode("selected-colour")}>
          Select the logo colour
        </Button>
        <Button type="button" variant="secondary" onClick={() => setTapMode("selected-background")}>
          Select the background
        </Button>
        <Button type="button" variant="ghost" onClick={onAdjust}>Adjust selection</Button>
        {reviewing ? <Button type="button" onClick={onAccept}>Looks right</Button> : null}
      </div>
      {tapMode ? <p className="text-supporting" role="status">Now tap that colour in the selected area.</p> : null}
    </section>
  );
}
