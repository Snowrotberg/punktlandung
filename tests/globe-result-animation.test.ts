import assert from "node:assert/strict";
import test from "node:test";
import { RESULT_REVEAL_TIMING, remainingResultRevealWaits } from "../lib/globeResultAnimation";

test("result reveal orders target landing, labels and final stillness", () => {
  assert.ok(RESULT_REVEAL_TIMING.targetLandingDurationMs > 0);
  assert.ok(RESULT_REVEAL_TIMING.targetLabelAfterRevealMs > RESULT_REVEAL_TIMING.targetLandingDurationMs * 0.16);
  assert.ok(RESULT_REVEAL_TIMING.targetLabelAfterRevealMs < RESULT_REVEAL_TIMING.targetLandingDurationMs);
  assert.ok(RESULT_REVEAL_TIMING.finalStillnessMs > 0);
});

test("result reveal waits clamp elapsed milestones without restarting them", () => {
  assert.deepEqual(remainingResultRevealWaits(1_000, 1_250), { landingMs: 3_950, labelMs: 650 });
  assert.deepEqual(remainingResultRevealWaits(1_000, 1_900), { landingMs: 3_300, labelMs: 0 });
  assert.deepEqual(remainingResultRevealWaits(1_000, 6_000), { landingMs: 0, labelMs: 0 });
});

test("reduced motion reveals the complete result without decorative waits", () => {
  assert.deepEqual(remainingResultRevealWaits(1_000, 1_000, true), { landingMs: 0, labelMs: 0 });
});
