"use client";

import { type ChangeEvent, useRef } from "react";
import type { useLogoUpload } from "@/features/upload/hooks/use-logo-upload";
import { LOGO_FILE_INPUT_ACCEPT } from "@/shared/constants/upload";

type ProofToolbarProps = {
  upload: ReturnType<typeof useLogoUpload>;
};

export function ProofToolbar({ upload }: ProofToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replace = (event: ChangeEvent<HTMLInputElement>) => {
    void upload.selectFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  return (
    <div className="proof-toolbar" aria-label="Logo actions">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={LOGO_FILE_INPUT_ACCEPT}
        onChange={replace}
        aria-label="Select replacement logo file"
      />
      <button
        type="button"
        className="proof-tool-button"
        aria-label="Replace logo"
        title="Replace logo"
        onClick={() => inputRef.current?.click()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
        </svg>
      </button>
      <button
        type="button"
        className="proof-tool-button proof-tool-remove"
        aria-label="Remove logo"
        title="Remove logo"
        onClick={upload.removeLogo}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
        </svg>
      </button>
    </div>
  );
}
