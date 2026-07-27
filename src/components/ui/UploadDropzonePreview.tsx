import { Button } from "@/components/ui/Button";

export function UploadDropzonePreview() {
  return (
    <aside
      aria-labelledby="upload-preview-title"
      aria-describedby="upload-preview-description upload-preview-status"
      className="upload-preview"
    >
      <div className="upload-preview-icon" aria-hidden="true">
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
        <p className="text-label upload-kicker">Coming next milestone</p>
        <h2 id="upload-preview-title" className="text-card-heading">
          Upload your logo
        </h2>
        <p id="upload-preview-description" className="text-supporting">
          PNG, JPG or SVG artwork will be supported.
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled
        aria-describedby="upload-preview-status"
      >
        Choose a file
      </Button>
      <p id="upload-preview-status" className="sr-only">
        Logo upload is unavailable in this milestone.
      </p>
    </aside>
  );
}

