"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  useRef,
} from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatAspectRatio } from "@/features/upload/utils/file-metadata";
import { useLogoUpload } from "@/features/upload/hooks/use-logo-upload";
import {
  LOGO_FILE_INPUT_ACCEPT,
  MAX_LOGO_FILE_SIZE_LABEL,
} from "@/shared/constants/upload";

export function LogoUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const {
    status,
    logo,
    error,
    selectFiles,
    rejectFiles,
    removeLogo,
    setDragActive,
    dismissError,
  } = useLogoUpload();

  const isValidating = status === "validating";
  const isReplacementError = Boolean(error && logo);

  const openPicker = () => {
    if (!isValidating) {
      inputRef.current?.click();
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void selectFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
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

    void selectFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <Card id="logo-upload" padding="none" className="logo-upload">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={LOGO_FILE_INPUT_ACCEPT}
        multiple={false}
        onChange={handleInputChange}
        aria-label="Select a logo file"
      />

      {logo && status !== "validating" ? (
        <div className="logo-preview" aria-live="polite">
          <div className="logo-preview-image-wrap">
            {/* Object URLs keep the original file browser-local; SVG markup is never injected. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo.previewUrl}
              alt={`Preview of ${logo.filename}`}
              className="logo-preview-image"
            />
          </div>
          <div className="logo-preview-details">
            <p className="text-eyebrow">Logo selected</p>
            <h2 id="logo-upload-heading" className="text-card-heading logo-filename">{logo.filename}</h2>
            <dl className="logo-metadata">
              <div><dt>Format</dt><dd>{logo.extension.toUpperCase()}</dd></div>
              <div><dt>File size</dt><dd>{logo.formattedSize}</dd></div>
              <div>
                <dt>Dimensions</dt>
                <dd>{logo.width && logo.height ? `${logo.width} × ${logo.height} px` : "Not specified"}</dd>
              </div>
              <div><dt>Aspect ratio</dt><dd>{formatAspectRatio(logo.aspectRatio)}</dd></div>
            </dl>
            <p className="upload-success" role="status">
              Your logo is ready for the next processing stage. It remains in this browser.
            </p>
            <div className="logo-actions">
              <Button type="button" variant="secondary" onClick={openPicker}>
                Replace Logo
              </Button>
              <Button type="button" variant="ghost" onClick={removeLogo}>
                Remove Logo
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={isValidating ? -1 : 0}
          aria-disabled={isValidating}
          aria-describedby="upload-instructions"
          className={`upload-dropzone ${
            status === "drag-active" ? "upload-dropzone-active" : ""
          }`}
          onClick={openPicker}
          onKeyDown={handleKeyDown}
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
              {isValidating ? "Checking your logo…" : "Upload your logo"}
            </h2>
            <p id="upload-instructions" className="text-supporting">
              Drag and drop one file here, or browse. PNG, JPG, JPEG, WebP or SVG,
              up to {MAX_LOGO_FILE_SIZE_LABEL}.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            loading={isValidating}
            loadingLabel="Checking"
            onClick={(event) => {
              event.stopPropagation();
              openPicker();
            }}
          >
            {isValidating ? "Checking" : "Browse Files"}
          </Button>
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
    </Card>
  );
}
