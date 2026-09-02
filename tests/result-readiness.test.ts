import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createResultReadinessCoordinator, resultExperienceReadinessStatus } from "../lib/resultReadiness";

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

test("a hanging runtime or style preparation degrades after the finite timeout", async () => {
  const never = () => new Promise<void>(() => undefined);
  const coordinator = createResultReadinessCoordinator(never, never, 10);
  const startedAt = Date.now();
  assert.deepEqual(await coordinator.prepare(), { mapRuntime: "degraded", mapStyle: "degraded" });
  assert.ok(Date.now() - startedAt < 1_000, "the coordinator must not inherit the hanging promise lifetime");
});

test("readiness distinguishes a complete prewarm from an explicitly degraded one", () => {
  assert.equal(resultExperienceReadinessStatus({ mapRuntime: "ready", mapStyle: "ready" }), "ready");
  assert.equal(resultExperienceReadinessStatus({ mapRuntime: "degraded", mapStyle: "ready" }), "degraded");
  assert.equal(resultExperienceReadinessStatus({ mapRuntime: "ready", mapStyle: "degraded" }), "degraded");
});

test("GameApp prewarms the result map without replacing the active transition surface", async () => {
  const [game, readiness, results, styles, responsiveCheck] = await Promise.all([
    readFile(new URL("../components/GameApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/resultReadiness.client.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/ResultsView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../scripts/responsive-check.mjs", import.meta.url), "utf8")
  ]);
  assert.match(game, /import \{ ResultsView \} from "\.\/ResultsView"/);
  assert.match(game, /prepareResultExperience\(\)/);
  assert.doesNotMatch(game, /resultTransitionPending|synchronizedGameplayRoute/);
  assert.doesNotMatch(game, /<GameplayRestoringView requiredStatus="results" preparing \/>/);
  assert.match(game, /window\.history\.replaceState\(window\.history\.state, "", gameplayRoute\)/);
  assert.doesNotMatch(game, /router\.replace\(gameplayRoute\)/);
  assert.match(readiness, /punktlandung-result-prewarm-\$\{status\}/);
  assert.match(readiness, /punktlandung-result-prewarm-settled/);
  assert.match(results, /punktlandung-submit-to-result-ui/);
  assert.match(results, /Ergebnis, Punkte und Navigation sind bereits verfügbar\./);
  assert.match(styles, /\.punktlandung-result-preparing-surface\s*\{[^}]*position:\s*absolute/s);
  assert.match(responsiveCheck, /submitToUiMs > 500/);
});
