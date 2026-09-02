import assert from "node:assert/strict";
import test from "node:test";
import { loadPlacementAfterVerification } from "../lib/rankedPlacementRetry";

test("verified ranking placement tolerates a short projection delay", async () => {
  let attempts = 0;
  const waits: number[] = [];
  const result = await loadPlacementAfterVerification(
    async () => {
      attempts += 1;
      return attempts < 3
        ? { ok: false as const, code: "not_ranked" }
        : { ok: true as const, placement: { rank: 7 } };
    },
    { delaysMs: [0, 10, 20, 30], pause: async (delayMs) => { waits.push(delayMs); } }
  );

  assert.deepEqual(result, { ok: true, placement: { rank: 7 } });
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [10, 20]);
});

test("ranking placement does not retry permanent failures", async () => {
  let attempts = 0;
  const result = await loadPlacementAfterVerification(
    async () => {
      attempts += 1;
      return { ok: false as const, code: "auth_required" };
    },
    { delaysMs: [0, 10, 20], pause: async () => undefined }
  );

  assert.deepEqual(result, { ok: false, code: "auth_required" });
  assert.equal(attempts, 1);
});
