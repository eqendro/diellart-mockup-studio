"use client";

import { Button } from "@/components/ui/Button";

export type VisualCandidate = { id: string; url: string };

type Props = {
  candidates: VisualCandidate[];
  message?: string | null;
  onAccept: (id: string) => void;
  onAdjust: () => void;
  onReplace: () => void;
};

export function AssistedExtraction({ candidates, message, onAccept, onAdjust, onReplace }: Props) {
  return (
    <section className="assisted-extraction" aria-labelledby="choose-result-heading">
      <header>
        <h3 id="choose-result-heading" className="text-section-heading">Choose the best result</h3>
      </header>
      {candidates.length ? (
        <div className="candidate-previews">
          {candidates.map((candidate) => (
            <article className="transparent-preview" key={candidate.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={candidate.url} alt="Logo result preview" />
              <Button type="button" onClick={() => onAccept(candidate.id)}>Use this logo</Button>
            </article>
          ))}
        </div>
      ) : <p className="upload-warning" role="status">{message ?? "We could not separate the logo cleanly. Try selecting a tighter area."}</p>}
      <div className="crop-actions">
        <Button type="button" variant="ghost" onClick={onAdjust}>Adjust selection</Button>
        <Button type="button" variant="secondary" onClick={onReplace}>Choose another image</Button>
      </div>
    </section>
  );
}
