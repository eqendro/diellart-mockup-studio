"use client";

import { useState, type ChangeEvent } from "react";

export function NativeFileInputDiagnostic() {
  const [result, setResult] = useState("No native change event received yet.");

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    setResult(
      file
        ? `Change received: ${file.name || "(no name)"}; ${file.type || "(no MIME)"}; ${file.size} bytes; ${file.lastModified}`
        : "Change received with no file.",
    );
    event.currentTarget.value = "";
  };

  return (
    <section aria-labelledby="native-input-heading">
      <h2 id="native-input-heading">Isolated native input</h2>
      <input
        id="isolated-native-file-input"
        type="file"
        accept="image/*"
        onChange={handleChange}
      />
      <p data-testid="native-input-result" aria-live="polite">{result}</p>
    </section>
  );
}
