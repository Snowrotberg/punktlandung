export const RESULT_REVEAL_TIMING = {
  targetLandingDurationMs: 3_100,
  // The label follows the first impact, while the diminishing rebounds are
  // still visible. Pin and badge therefore remain two readable events.
  targetLabelAfterRevealMs: 800,
  finalStillnessMs: 80
} as const;

export type ResultRevealPhase = "prepared" | "route" | "landing" | "landed" | "labels" | "settled" | "reduced-settled";

export function remainingResultRevealWaits(
  targetRevealedAtMs: number,
  nowMs: number,
  reducedMotion = false
): { landingMs: number; labelMs: number } {
  if (reducedMotion) return { landingMs: 0, labelMs: 0 };
  return {
    landingMs: Math.max(0, targetRevealedAtMs + RESULT_REVEAL_TIMING.targetLandingDurationMs - nowMs),
    labelMs: Math.max(0, targetRevealedAtMs + RESULT_REVEAL_TIMING.targetLabelAfterRevealMs - nowMs)
  };
}
