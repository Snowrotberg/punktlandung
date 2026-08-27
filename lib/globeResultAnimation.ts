export const RESULT_REVEAL_TIMING = {
  targetLandingDurationMs: 4_200,
  targetLabelAfterLandingGapMs: 320,
  finalStillnessMs: 80
} as const;

export type ResultRevealPhase = "prepared" | "route" | "landing" | "landed" | "labels" | "settled" | "reduced-settled";

export function remainingResultRevealWaits(
  targetRevealedAtMs: number,
  nowMs: number,
  reducedMotion = false
): { landingMs: number; postLandingLabelMs: number } {
  if (reducedMotion) return { landingMs: 0, postLandingLabelMs: 0 };
  return {
    landingMs: Math.max(0, targetRevealedAtMs + RESULT_REVEAL_TIMING.targetLandingDurationMs - nowMs),
    // This gap always starts when the product marks the landing complete. It
    // must not be consumed by a long camera frame or slow tile delivery.
    postLandingLabelMs: RESULT_REVEAL_TIMING.targetLabelAfterLandingGapMs
  };
}
