export const RESULT_REVEAL_TIMING = {
  targetLandingDurationMs: 4_200,
  // The first ground contact occurs at 16% of the shared landing keyframes.
  // Reveal the label shortly afterwards, while the impact rings are still
  // visible, instead of waiting for every diminishing rebound to finish.
  targetLabelAfterRevealMs: 900,
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
