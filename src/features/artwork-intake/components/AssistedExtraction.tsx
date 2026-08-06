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
  const hasCandidates = candidates.length > 0;
  return (
    <section className="assisted-extraction" aria-labelledby="choose-result-heading">
      <header>
        <h3 id="choose-result-heading" className="text-section-heading">
          {hasCandidates ? "Choose the best result" : "We need a tighter selection"}
        </h3>
        {!hasCandidates ? <p className="text-supporting">Adjust the box so it contains the logo with as little background as possible.</p> : null}
      </header>
      {hasCandidates ? (
        <div className="candidate-previews">
          {candidates.map((candidate) => (
            <article className="transparent-preview" key={candidate.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={candidate.url} alt="Logo result preview" />
              <Button type="button" onClick={() => onAccept(candidate.id)}>Use this logo</Button>
            </article>
          ))}
        </div>
      ) : message ? <p className="upload-warning" role="status">{message}</p> : null}
      <div className="crop-actions">
        <Button type="button" variant={hasCandidates ? "ghost" : "primary"} onClick={onAdjust}>Adjust selection</Button>
        <Button type="button" variant="secondary" onClick={onReplace}>Choose another image</Button>
      </div>
    </section>
  );
}
