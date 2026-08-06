export type CandidateConfidence = { confidence: number };

export type CandidateReviewPlan<T> =
  | { mode: "auto-select"; candidates: [T] }
  | { mode: "review-two"; candidates: T[] }
  | { mode: "tighter-selection"; candidates: [] }
  | { mode: "debug-all"; candidates: T[] };

export function planCandidateReview<T extends CandidateConfidence>(
  candidates: T[],
  debug = false,
): CandidateReviewPlan<T> {
  const ranked = [...candidates].sort((a, b) => b.confidence - a.confidence);
  if (debug) return { mode: "debug-all", candidates: ranked };
  const best = ranked[0];
  if (!best || best.confidence < 0.45) return { mode: "tighter-selection", candidates: [] };
  if (best.confidence >= 0.78) return { mode: "auto-select", candidates: [best] };
  return { mode: "review-two", candidates: ranked.slice(0, 2) };
}
