import { describe, expect, it } from "vitest";
import { planCandidateReview } from "../../src/features/artwork-intake/candidate-review";

const candidate = (id: string, confidence: number) => ({ id, confidence });

describe("candidate review policy", () => {
  it("automatically selects the strongest high-confidence candidate", () => {
    expect(planCandidateReview([candidate("second", 0.8), candidate("best", 0.91)])).toEqual({
      mode: "auto-select",
      candidates: [candidate("best", 0.91)],
    });
  });

  it("shows only the two strongest medium-confidence candidates", () => {
    const plan = planCandidateReview([
      candidate("third", 0.5), candidate("best", 0.7), candidate("second", 0.6),
    ]);
    expect(plan.mode).toBe("review-two");
    expect(plan.candidates.map((entry) => entry.id)).toEqual(["best", "second"]);
  });

  it("requests a tighter selection at low confidence", () => {
    expect(planCandidateReview([candidate("weak", 0.44)])).toEqual({
      mode: "tighter-selection",
      candidates: [],
    });
  });

  it("keeps all ranked candidates available in debug mode", () => {
    const plan = planCandidateReview([candidate("low", 0.2), candidate("high", 0.9)], true);
    expect(plan.mode).toBe("debug-all");
    expect(plan.candidates.map((entry) => entry.id)).toEqual(["high", "low"]);
  });
});
