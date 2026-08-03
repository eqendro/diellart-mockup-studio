"use client";

import {
  type DragEvent,
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatAspectRatio } from "@/features/upload/utils/file-metadata";
import type { useLogoUpload } from "@/features/upload/hooks/use-logo-upload";
import type { ReturnTypeOfPreparedArtwork } from "@/features/logo-engine/types/internal";
import {
  getSemanticSizeLabel,
  type ArtworkPlacement,
  type PlacementDirection,
  type PlacementLimits,
} from "@/features/mockup-engine/placement";
import {
  LOGO_FILE_INPUT_ACCEPT,
  MAX_LOGO_FILE_SIZE_LABEL,
} from "@/shared/constants/upload";
import type { UploadSource } from "@/features/upload/types/logo-upload";

type LogoUploadProps = {
  upload: ReturnType<typeof useLogoUpload>;
  preparation?: ReturnTypeOfPreparedArtwork;
  placement?: ArtworkPlacement;
  onPlacementChange?: (placement: ArtworkPlacement) => void;
  onResetPlacement?: () => void;
  onArtworkVersionChange?: (showOriginal: boolean) => void;
  placementLimits?: PlacementLimits;
  onMovePlacement?: (direction: PlacementDirection) => void;
  onCentrePlacement?: () => void;
  simplified?: boolean;
  recoveryOnly?: boolean;
  approved?: boolean;
  onApprove?: () => void;
  onEditPlacement?: () => void;
  hideAssetActions?: boolean;
};

function artworkStatusMessage(
  preparation: ReturnTypeOfPreparedArtwork | undefined,
) {
  if (!preparation?.asset) return "Analysing your artwork…";
  if (preparation.processingState === "analysing") return "Analysing your artwork…";
  if (preparation.processingState === "selecting") return "Selecting logo area";
  if (preparation.processingState === "cropping") return "Cropping selected area…";
  if (preparation.processingState === "preparing") return "Preparing your logo…";
  if (preparation.processingState === "needs-review") return "Needs review";
  if (preparation.processingState === "failed") return "Preparation failed";
  if (preparation.processingState === "ready") return "Artwork ready";
  const result = preparation.intakeResult;
  if (result?.requiresCrop) {
    return "This looks like a photograph or document. The next step will allow you to select your logo.";
  }
  if (result?.recommendedWorkflow === "ManualReview") {
    return "We could not identify this artwork confidently. Your original artwork has been kept for review.";
  }
  if (result?.classification === "LogoOnPlainBackground") return "Logo detected. Preparing your preview…";
  if (result?.classification === "TransparentLogo") {
    return preparation.asset.preparation.status === "processing"
      ? "Transparent logo detected. Preparing artwork…"
      : "Transparent logo detected. Artwork ready";
  }
  if (result?.classification === "Document") {
    return "Document detected. Preparing logo…";
  }
  return preparation.asset.preparation.status === "processing"
    ? "Preparing your artwork…"
    : "Artwork ready";
}

export function LogoUpload({
  upload,
  preparation,
  placement,
  onPlacementChange,
  onResetPlacement,
  onArtworkVersionChange,
  placementLimits,
  onMovePlacement,
  onCentrePlacement,
  simplified = false,
  recoveryOnly = false,
  approved = false,
  onApprove,
  onEditPlacement,
  hideAssetActions = false,
}: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputId = "gallery-logo-input";
  const cameraInputId = "camera-logo-input";
  const pendingPickerRef = useRef<{ source: "gallery" | "camera"; openedAt: number; changeReceived: boolean } | null>(null);
  const dragDepthRef = useRef(0);
  const [fineTuneOpen, setFineTuneOpen] = useState(false);
  const showUploadDebug = useSyncExternalStore(
    () => () => undefined,
    () => process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("debugUpload") === "1",
    () => false,
  );
  const {
    status,
    logo,
    error,
    selectFiles,
    processSelectedArtworkFile,
    rejectFiles,
    removeLogo,
    setDragActive,
    dismissError,
    trace,
    recordTrace,
  } = upload;

  const isValidating = status === "reading" || status === "validating";
  const isReplacementError = Boolean(error && logo);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setFineTuneOpen(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const checkPickerReturn = () => {
      const pending = pendingPickerRef.current;
      if (!pending || pending.changeReceived || document.visibilityState !== "visible") return;
      if (Date.now() - pending.openedAt < 500) return;
      recordTrace(
        "picker returned without change",
        `${pending.source}: Picker returned, but no file change event was received.`,
        "error",
      );
      pendingPickerRef.current = null;
    };
    document.addEventListener("visibilitychange", checkPickerReturn);
    window.addEventListener("focus", checkPickerReturn);
    return () => {
      document.removeEventListener("visibilitychange", checkPickerReturn);
      window.removeEventListener("focus", checkPickerReturn);
    };
  }, [recordTrace]);

  const reportNativeActivation = (
    kind: "gallery" | "camera",
    input: HTMLInputElement | null,
  ) => {
    if (process.env.NODE_ENV === "production") return;
    pendingPickerRef.current = { source: kind, openedAt: Date.now(), changeReceived: false };
    recordTrace(`${kind} control activated`, input ? `input ${input.id} exists` : "INPUT_MISSING", input ? "ok" : "error");
    console.debug("[native-upload-control]", {
      interactionReceived: true,
      kind,
      inputExists: Boolean(input),
      disabled: input?.disabled ?? null,
      connected: input?.isConnected ?? false,
      pickerActivationAttempted: Boolean(input && !input.disabled),
    });
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>, source: UploadSource) => {
    const input = event.currentTarget;
    if (pendingPickerRef.current) pendingPickerRef.current.changeReceived = true;
    recordTrace("native picker returned", source);
    recordTrace("change event fired", input.id);
    recordTrace("event target file count", String(input.files?.length ?? 0));
    // Capture the File objects before clearing the control. Android content
    // provider data must never be read from the event after an async boundary.
    const files = Array.from(input.files ?? []);
    const file = files[0];
    if (!file) {
      recordTrace("no file returned", source, "info");
      return;
    }
    recordTrace("file captured", source);
    recordTrace("file metadata", `${file.name || "(no name)"}; ${file.type || "(no MIME)"}; ${file.size} bytes; ${file.lastModified}`);
    input.value = "";
    recordTrace("input reset", "after File capture");
    if (process.env.NODE_ENV !== "production") {
      console.debug("[native-upload-change]", {
        inputId: input.id,
        changeEventReceived: true,
        files: files.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
        })),
      });
    }
    void processSelectedArtworkFile(file, source);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragActive(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;

    const items = Array.from(event.dataTransfer.items);
    if (
      items.length !== 1 ||
      items.some((item) => item.kind !== "file")
    ) {
      rejectFiles(
        items.length > 1
          ? "Select only one logo at a time."
          : "The dropped item is not a file. Choose a PNG, JPG, JPEG, WebP or SVG file.",
      );
      return;
    }

    void selectFiles(Array.from(event.dataTransfer.files), "drop");
  };

  return (
    <Card id="logo-upload" padding="none" className="logo-upload">
      <input
        id={galleryInputId}
        ref={inputRef}
        type="file"
        className="native-file-input"
        accept={LOGO_FILE_INPUT_ACCEPT}
        disabled={isValidating}
        multiple={false}
        onChange={(event) => handleFileSelection(event, "gallery")}
        aria-label="Select a logo file"
      />
      <input
        id={cameraInputId}
        ref={cameraInputRef}
        type="file"
        className="native-file-input"
        accept="image/*"
        capture="environment"
        disabled={isValidating}
        multiple={false}
        onChange={(event) => handleFileSelection(event, "camera")}
        aria-label="Take a photo of your logo"
      />

      {logo && status !== "validating" ? (
        <div className="artwork-panel" aria-live="polite">
          {!simplified || recoveryOnly ? <div className="artwork-panel-heading">
            <p className="text-eyebrow">Your artwork</p>
            <h2 id="logo-upload-heading" className="text-card-heading logo-filename">
              {recoveryOnly
                ? "We could not prepare this image."
                : logo.filename}
            </h2>
          </div> : null}
          <div className="artwork-controls">
            {recoveryOnly ? (
              <>
                <Button type="button" onClick={preparation?.requestCrop}>
                  Select the logo area
                </Button>
                <label
                  htmlFor={galleryInputId}
                  className="button button-secondary button-medium"
                  onClick={() => reportNativeActivation("gallery", inputRef.current)}
                >
                  Choose another image
                </label>
              </>
            ) : approved ? (
              <div className="approval-success" role="status">
                <p className="text-card-heading">Your preview is ready.</p>
                <p className="text-supporting">
                  Your logo placement has been saved for this proof.
                </p>
                <Button type="button" variant="secondary" onClick={onEditPlacement}>
                  Edit placement
                </Button>
              </div>
            ) : (
              <>
            {!simplified && preparation?.outcome?.status === "review-required" ? (
              <div className="candidate-review">
                <p className="text-card-heading">Here is the logo we prepared.</p>
                <p className="text-supporting">
                  Choose the version that looks best, or adjust the selected area.
                </p>
                {preparation.outcome.preparedCandidate ? (
                  <Button
                    type="button"
                    variant={preparation.showOriginal ? "secondary" : "primary"}
                    onClick={() => preparation.setShowOriginal(false)}
                  >
                    {preparation.asset?.preparation.status === "error" &&
                    preparation.croppedArtwork
                      ? "Use cropped area"
                      : "Use prepared artwork"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={preparation.requestCrop}
                >
                  Adjust selection
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => preparation.setShowOriginal(true)}
                >
                  Use original
                </Button>
              </div>
            ) : !simplified && preparation?.outcome?.status === "failed" ? (
              <div className="candidate-review">
                <p className="text-card-heading">We need a little help identifying your logo.</p>
                <Button type="button" variant="secondary" onClick={preparation.requestCrop}>
                  Adjust selection
                </Button>
              </div>
            ) : null}
            {placement && placementLimits && onPlacementChange ? (
              <>
              <Button
                type="button"
                variant="ghost"
                className="mobile-reset-placement"
                onClick={onResetPlacement}
              >
                Reset placement
              </Button>
              <details
                className="fine-tune-placement"
                open={fineTuneOpen}
                onToggle={(event) => setFineTuneOpen(event.currentTarget.open)}
              >
                <summary>Fine-tune placement</summary>
              <div className="placement-controls">
                <label className="placement-control">
                  <span>
                    Logo size
                    <output aria-live="polite">
                      {getSemanticSizeLabel(placement.scale)}
                    </output>
                  </span>
                  <input
                    type="range"
                    min={placementLimits.minimumScale}
                    max={placementLimits.maximumScale}
                    step="0.01"
                    value={placement.scale}
                    onChange={(event) =>
                      onPlacementChange({
                        ...placement,
                        scale: Number(event.target.value),
                      })
                    }
                    aria-valuetext={getSemanticSizeLabel(placement.scale)}
                  />
                  <span className="size-scale-labels" aria-hidden="true">
                    <span>Smaller</span>
                    <span className="recommended-marker">Recommended</span>
                    <span>Larger</span>
                  </span>
                </label>
                <fieldset className="position-control">
                  <legend>Logo position</legend>
                  <button type="button" className="position-button position-up" aria-label="Move logo up" onClick={() => onMovePlacement?.("up")}>↑</button>
                  <button type="button" className="position-button position-left" aria-label="Move logo left" onClick={() => onMovePlacement?.("left")}>←</button>
                  <button type="button" className="position-centre" aria-label="Centre logo" onClick={onCentrePlacement}>Centre</button>
                  <button type="button" className="position-button position-right" aria-label="Move logo right" onClick={() => onMovePlacement?.("right")}>→</button>
                  <button type="button" className="position-button position-down" aria-label="Move logo down" onClick={() => onMovePlacement?.("down")}>↓</button>
                </fieldset>
                <Button
                  type="button"
                  variant="ghost"
                  className="desktop-reset-placement"
                  onClick={onResetPlacement}
                >
                  Reset placement
                </Button>
              </div>
              </details>
              </>
            ) : null}
            {!simplified && preparation?.asset &&
            preparation.asset.preparedUrl !== preparation.asset.originalUrl ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  onArtworkVersionChange?.(!preparation.showOriginal)
                }
              >
                {preparation.showOriginal
                  ? "Use prepared artwork"
                  : "Show original background"}
              </Button>
            ) : null}
            {!simplified && preparation?.asset && preparation.outcome?.status === "ready" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={preparation.requestCrop}
              >
                Adjust selection
              </Button>
            ) : null}
            {!hideAssetActions ? (
              <>
                <label
                  htmlFor={galleryInputId}
                  className="button button-secondary button-medium"
                  onClick={() => reportNativeActivation("gallery", inputRef.current)}
                >
                  Replace Logo
                </label>
                <Button type="button" variant="ghost" onClick={removeLogo}>
                  Remove Logo
                </Button>
              </>
            ) : null}
            {simplified ? (
              <Button type="button" className="approval-button" onClick={onApprove}>
                Approve digital proof
              </Button>
            ) : null}
              </>
            )}
          </div>
          {!simplified && !recoveryOnly ? <div className="logo-preview-image-wrap">
            {preparation?.outcome?.status === "review-required" &&
            preparation.outcome.preparedCandidate &&
            preparation.asset ? (
              <div className="candidate-previews">
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preparation.asset.originalUrl} alt={`Original ${logo.filename}`} />
                  <figcaption>Original</figcaption>
                </figure>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preparation.asset.preparedUrl} alt={`Prepared ${logo.filename}`} />
                  <figcaption>
                    {preparation.asset.preparation.status === "error" &&
                    preparation.croppedArtwork
                      ? "Cropped"
                      : "Prepared"}
                  </figcaption>
                </figure>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  preparation?.asset
                    ? preparation.showOriginal
                      ? preparation.asset.originalUrl
                      : preparation.selectedArtworkUrl ??
                        preparation.asset.preparedUrl
                    : logo.previewUrl
                }
                alt={`${preparation?.showOriginal ? "Original" : "Prepared"} preview of ${logo.filename}`}
                className="logo-preview-image"
              />
            )}
          </div> : null}
          {!simplified && !recoveryOnly ? <div className="logo-preview-details">
            <dl className="logo-metadata">
              <div><dt>Format</dt><dd>{logo.extension.toUpperCase()}</dd></div>
              <div><dt>File size</dt><dd>{logo.formattedSize}</dd></div>
              <div>
                <dt>Dimensions</dt>
                <dd>{logo.width && logo.height ? `${logo.width} × ${logo.height} px` : "Not specified"}</dd>
              </div>
              <div><dt>Aspect ratio</dt><dd>{formatAspectRatio(logo.aspectRatio)}</dd></div>
            </dl>
            <p
              className={`upload-success ${
                preparation?.asset?.preparation.status === "error" ? "upload-warning" : ""
              }`}
              role="status"
              aria-live="polite"
            >
              {artworkStatusMessage(preparation)}
            </p>
          </div> : null}
        </div>
      ) : (
        <div
          aria-describedby="upload-instructions"
          className={`upload-dropzone ${
            status === "drag-active" ? "upload-dropzone-active" : ""
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="upload-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p className="text-eyebrow">
              {status === "drag-active" ? "Drop your file here" : "Browser-local preview"}
            </p>
            <h2 id="logo-upload-heading" className="text-section-heading upload-heading">
              {status === "reading"
                ? "Reading your image…"
                : isValidating
                  ? "Checking your logo…"
                  : "Upload your logo"}
            </h2>
            <p id="upload-instructions" className="text-supporting">
              Drag and drop one file here, or browse. PNG, JPG, JPEG, WebP or SVG,
              up to {MAX_LOGO_FILE_SIZE_LABEL}.
            </p>
          </div>
          <div className="upload-choice-actions">
            <label
              htmlFor={galleryInputId}
              className={`button button-secondary button-medium ${
                isValidating ? "button-disabled" : ""
              }`}
              aria-disabled={isValidating}
              onClick={() => reportNativeActivation("gallery", inputRef.current)}
            >
              {status === "reading" ? "Reading your image…" : isValidating ? "Checking" : "Choose from device"}
            </label>
            <label
              htmlFor={cameraInputId}
              className="button button-ghost button-medium camera-upload-action"
              onClick={() => reportNativeActivation("camera", cameraInputRef.current)}
            >
              Take a photo
            </label>
          </div>
        </div>
      )}

      {error ? (
        <div className="upload-error" role="alert">
          <div>
            <strong>
              {isReplacementError
                ? "Replacement logo not accepted"
                : "Logo not accepted"}
            </strong>
            <p>
              {error}
              {isReplacementError ? " Your previous logo has been kept." : ""}
            </p>
          </div>
          <Button type="button" variant="ghost" size="small" onClick={dismissError}>
            Dismiss
          </Button>
        </div>
      ) : null}
      {showUploadDebug ? (
        <aside className="upload-debug-panel" aria-label="Upload trace" aria-live="polite">
          <strong>Upload trace</strong>
          {trace.length ? (
            <ol>
              {trace.map((entry) => (
                <li key={entry.id} data-status={entry.status}>
                  <span aria-hidden="true">{entry.status === "error" ? "✗" : "✓"}</span>{" "}
                  {entry.stage}{entry.detail ? `: ${entry.detail}` : ""}
                </li>
              ))}
            </ol>
          ) : <p>No upload event received yet.</p>}
        </aside>
      ) : null}
    </Card>
  );
}
