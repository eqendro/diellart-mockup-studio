"use client";

import { useState, type ChangeEvent } from "react";
import { decodeMobileImage } from "@/features/upload/utils/decode-mobile-image";

type Result = {
  filename: string;
  mime: string;
  size: number;
  decoder?: string;
  width?: number;
  height?: number;
  orientation?: string;
  outcome: string;
};

export function DecoderDiagnostic() {
  const [trace, setTrace] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  const decode = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      setTrace(["No file returned."]);
      return;
    }
    setTrace([`File received: ${file.name}; ${file.type || "(no MIME)"}; ${file.size} bytes`]);
    setResult({ filename: file.name, mime: file.type, size: file.size, outcome: "Decoding…" });
    try {
      const decoded = await decodeMobileImage(file, {
        onStage: (stage, detail, status) =>
          setTrace((current) => [...current, `${status === "error" ? "✗" : "✓"} ${stage}${detail ? `: ${detail}` : ""}`]),
      });
      setResult({
        filename: file.name,
        mime: file.type,
        size: file.size,
        decoder: decoded.decoder,
        width: decoded.width,
        height: decoded.height,
        orientation: decoded.orientation,
        outcome: "Success",
      });
      URL.revokeObjectURL(decoded.objectUrl);
    } catch (error) {
      setResult({
        filename: file.name,
        mime: file.type,
        size: file.size,
        outcome: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });
    }
  };

  return (
    <section aria-labelledby="decoder-diagnostic-heading" className="hydration-probe">
      <h2 id="decoder-diagnostic-heading">Decode this file</h2>
      <input id="canonical-decoder-input" type="file" accept="image/*" onChange={(event) => void decode(event)} />
      {result ? (
        <dl data-testid="decoder-result">
          <dt>Filename</dt><dd>{result.filename}</dd>
          <dt>MIME</dt><dd>{result.mime || "(empty)"}</dd>
          <dt>Size</dt><dd>{result.size} bytes</dd>
          <dt>Decoder</dt><dd>{result.decoder ?? "Not completed"}</dd>
          <dt>Dimensions</dt><dd>{result.width && result.height ? `${result.width}×${result.height}` : "Not completed"}</dd>
          <dt>Orientation</dt><dd>{result.orientation ?? "Not completed"}</dd>
          <dt>Outcome</dt><dd>{result.outcome}</dd>
        </dl>
      ) : null}
      <ol data-testid="decoder-trace">{trace.map((entry, index) => <li key={`${index}-${entry}`}>{entry}</li>)}</ol>
    </section>
  );
}
