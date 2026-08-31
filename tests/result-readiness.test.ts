import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createResultReadinessCoordinator } from "../lib/resultReadiness";

test("result readiness starts runtime and style once and shares the in-flight contract", async () => {
  let runtimeCalls = 0;
  let styleCalls = 0;
  const coordinator = createResultReadinessCoordinator(
    async () => { runtimeCalls += 1; },
    async () => { styleCalls += 1; }
  );
  const first = coordinator.prepare();
  const second = coordinator.prepare();
  assert.equal(first, second);
  assert.deepEqual(await first, { mapRuntime: "ready", mapStyle: "ready" });
  assert.equal(runtimeCalls, 1);
  assert.equal(styleCalls, 1);
});

test("a failed prewarm degrades explicitly instead of deadlocking result navigation", async () => {
  const coordinator = createResultReadinessCoordinator(
    async () => { throw new Error("runtime unavailable"); },
    async () => undefined
  );
  assert.deepEqual(await coordinator.prepare(), { mapRuntime: "degraded", mapStyle: "ready" });
});

test("GameApp holds the play route until the explicit result contract is ready", async () => {
  const source = await readFile(new URL("../components/GameApp.tsx", import.meta.url), "utf8");
  assert.match(source, /prepareResultExperience\(\)/);
  assert.match(source, /resultTransitionPending && pathname === "\/spielen" \? "\/spielen" : gameplayRoute/);
  assert.match(source, /<GameplayRestoringView requiredStatus="results" preparing \/>/);
});
