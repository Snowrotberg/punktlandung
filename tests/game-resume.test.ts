import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSetupResumeRequest,
  consumeSetupResumeRequest,
  explicitRankedResumeGameId,
  hasSetupResumeRequest,
  requestSetupResume,
  setupResumeUrl,
  isResumableGameStatus,
  shouldDiscardResumeOnHistoryExit,
  shouldRestoreStoredGame,
  shouldStartTimerAfterImageReady
} from "../lib/gameResume.client";

test("stored games restore only for an explicit recovery route", () => {
  assert.equal(shouldRestoreStoredGame("guessing", false), false);
  assert.equal(shouldRestoreStoredGame("results", false), false);
  assert.equal(shouldRestoreStoredGame("finished", false), false);
  assert.equal(shouldRestoreStoredGame("lobby", false), false);
  assert.equal(shouldRestoreStoredGame("guessing", true), true);
  assert.equal(shouldRestoreStoredGame("results", true), true);
  assert.equal(shouldRestoreStoredGame("finished", true), false);
  assert.equal(shouldRestoreStoredGame("lobby", true), true);
});

test("only active rounds and between-round results can be resumed", () => {
  assert.equal(isResumableGameStatus("guessing"), true);
  assert.equal(isResumableGameStatus("results"), true);
  assert.equal(isResumableGameStatus("finished"), false);
  assert.equal(isResumableGameStatus("lobby"), false);
});

test("a second browser back from setup deliberately discards resume", () => {
  assert.equal(shouldDiscardResumeOnHistoryExit(true, "/solo-modus", "/"), true);
  assert.equal(shouldDiscardResumeOnHistoryExit(true, "/solo-modus", "/community"), true);
  assert.equal(shouldDiscardResumeOnHistoryExit(true, "/solo-modus", "/solo-modus"), false);
  assert.equal(shouldDiscardResumeOnHistoryExit(false, "/solo-modus", "/"), false);
});

test("image remounts never restart an existing round timer", () => {
  assert.equal(shouldStartTimerAfterImageReady(false, 1_000, 61_000), false);
  assert.equal(shouldStartTimerAfterImageReady(true, 1_000, 61_000), false);
  assert.equal(shouldStartTimerAfterImageReady(true, null, null), true);
});

test("ranked setup sentinel is not mistaken for a game id", () => {
  assert.equal(explicitRankedResumeGameId("ranked"), null);
  assert.equal(explicitRankedResumeGameId("1"), null);
  assert.equal(explicitRankedResumeGameId("ranked_game_123"), "ranked_game_123");
});

test("browser back always targets the matching resumable setup route", () => {
  assert.equal(setupResumeUrl("/solo-modus", "ranked"), "/solo-modus?resume=ranked");
  assert.equal(setupResumeUrl("/solo-modus", "local"), "/solo-modus?resume=1");
  assert.equal(setupResumeUrl("/party-modus", "local"), "/party-modus?resume=1");
});

test("local and ranked resume markers cannot consume each other", () => {
  const storage = new Map<string, string>();
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    } }
  });

  try {
    requestSetupResume("ranked");
    assert.equal(hasSetupResumeRequest("ranked"), true);
    assert.equal(consumeSetupResumeRequest("local"), false);
    assert.equal(consumeSetupResumeRequest("ranked"), true);
    assert.equal(hasSetupResumeRequest(), false);
    requestSetupResume("local");
    clearSetupResumeRequest();
    assert.equal(hasSetupResumeRequest(), false);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
});
