"use client";

import { useEffect, useRef, useState } from "react";
import { REGRESSION_FIXTURES, type RegressionFixtureName } from "./fixture-config";
import { runArtworkRegressionFixture, type ArtworkRegressionRun } from "./regression-runner";

type CaseState = { status: "idle" | "running" | "complete"; run?: ArtworkRegressionRun; error?: string };

export default function ArtworkRegressionClient() {
  const [cases, setCases] = useState<Record<string, CaseState>>(() =>
    Object.fromEntries(REGRESSION_FIXTURES.map(({ name }) => [name, { status: "idle" }])));
  const [runningAll, setRunningAll] = useState(false);
  const releases = useRef(new Map<string, () => void>());

  useEffect(() => () => {
    releases.current.forEach((release) => release());
    releases.current.clear();
  }, []);

  const runOne = async (name: RegressionFixtureName) => {
    setCases((current) => ({ ...current, [name]: { status: "running" } }));
    try {
      const run = await runArtworkRegressionFixture(name);
      releases.current.get(name)?.();
      releases.current.set(name, run.release);
      setCases((current) => ({ ...current, [name]: { status: "complete", run } }));
      return run;
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      setCases((current) => ({ ...current, [name]: { status: "complete", error: message } }));
      return null;
    }
  };

  const runAll = async () => {
    setRunningAll(true);
    try {
      for (const fixture of REGRESSION_FIXTURES) await runOne(fixture.name);
    } finally {
      setRunningAll(false);
    }
  };

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>Artwork regression</h1>
      <p>Real Samsung fixtures executed through the production browser-local artwork functions.</p>
      <button type="button" onClick={() => void runAll()} disabled={runningAll}>
        {runningAll ? "Running all fixtures…" : "Run all fixtures"}
      </button>

      <div style={{ display: "grid", gap: 24, marginTop: 24 }}>
        {REGRESSION_FIXTURES.map((fixture) => {
          const state = cases[fixture.name];
          const run = state.run;
          return (
            <section key={fixture.name} data-testid={`fixture-${fixture.name}`} style={{ border: "1px solid #bbb", borderRadius: 8, padding: 16 }}>
              <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                <div>
                  <h2 style={{ margin: 0 }}>{fixture.name}</h2>
                  <p data-testid={`status-${fixture.name}`}>
                    {state.status === "running" ? "Running" : run ? (run.result.pass ? "PASS" : "FAIL") : state.error ? "FAIL" : "Not run"}
                  </p>
                </div>
                <button type="button" onClick={() => void runOne(fixture.name)} disabled={state.status === "running"}>Run again</button>
              </header>

              {state.error ? <p role="alert">{state.error}</p> : null}
              {run ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                    {[
                      ["Original", run.visuals.originalUrl],
                      ["Normalised / oriented", run.visuals.normalisedUrl],
                      ["Prepared candidate", run.visuals.candidateUrl],
                      ["Monochrome", run.visuals.monochromeUrl],
                    ].map(([label, url]) => (
                      <figure key={label} style={{ margin: 0 }}>
                        <div style={{ minHeight: 150, display: "grid", placeItems: "center", padding: 8, background: label === "Prepared candidate" ? "repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0/20px 20px" : "#f3f3f3" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {url ? <img src={url} alt={`${label} ${fixture.name}`} style={{ display: "block", maxWidth: "100%", maxHeight: 240 }} /> : <span>Not produced</span>}
                        </div>
                        <figcaption>{label}</figcaption>
                      </figure>
                    ))}
                  </div>

                  <dl>
                    <dt>Decode</dt><dd>{run.result.decodeStatus}</dd>
                    <dt>Orientation</dt><dd>{run.result.orientation.method ?? "unknown"}; {run.result.orientation.original ?? "?"} → {run.result.orientation.output ?? "?"}; normalised: {String(run.result.orientation.normalised)}; aspect preserved: {String(run.result.orientation.aspectPreserved)}</dd>
                    <dt>Classification</dt><dd>{run.result.classification ?? "Unavailable"}</dd>
                    <dt>Preparation route</dt><dd>{run.result.route ?? "Unavailable"}</dd>
                    <dt>Candidate dimensions</dt><dd>{run.result.candidateDimensions ?? "None"}</dd>
                    <dt>Transparency ratio</dt><dd>{run.result.candidateValidation?.transparencyRatio ?? "Unavailable"}</dd>
                    <dt>Foreground bounds</dt><dd>{run.result.foregroundBounds ? JSON.stringify(run.result.foregroundBounds) : "Unavailable"}</dd>
                    <dt>Detected colour</dt><dd>{run.result.detectedColour ? `${run.result.detectedColour.hex} (${run.result.detectedColour.confident ? "confident" : "not confident"})` : "Unavailable"}</dd>
                    <dt>Final customer state</dt><dd>{run.result.finalCustomerState}</dd>
                    <dt>Renderer handoff</dt><dd>{run.result.rendererAllowed ? "allowed" : "blocked"}</dd>
                    <dt>Processing time</dt><dd>{run.result.processingTimeMs.toFixed(1)} ms</dd>
                  </dl>
                  <details>
                    <summary>Diagnostic metrics</summary>
                    <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify({ analysis: run.result.metrics, candidate: run.result.candidateValidation }, null, 2)}</pre>
                  </details>
                  <div>
                    <strong>Failure reasons</strong>
                    {run.result.failureReasons.length ? <ul>{run.result.failureReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>None.</p>}
                  </div>
                  <script type="application/json" data-testid={`result-${fixture.name}`} dangerouslySetInnerHTML={{ __html: JSON.stringify(run.result).replaceAll("<", "\\u003c") }} />
                </>
              ) : null}
            </section>
          );
        })}
      </div>
    </main>
  );
}
