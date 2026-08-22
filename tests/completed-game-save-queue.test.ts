import assert from "node:assert/strict";
import test from "node:test";
import { enqueueCompletedGameSave, readCompletedGameSaves, removeCompletedGameSave } from "../lib/completedGameSaveQueue.client";

function save(saveKey: string) {
  return {
    saveKey,
    category: "cities" as const,
    timeLimitSec: 60,
    difficulty: "medium" as const,
    noZoom: false,
    score: 100,
    completedRounds: 1,
    roundDurationMs: 60_000,
    totalResponseTimeMs: 5_000,
    startedAt: Date.now(),
    completedAt: Date.now(),
    rounds: [{
      roundId: `${saveKey}_1`,
      roundNumber: 1,
      locationId: "test-location",
      locationSnapshot: {},
      startedAt: Date.now(),
      resolvedAt: Date.now(),
      result: {
        points: 100,
        distanceKm: 1,
        badge: "Test",
        countryCorrect: true,
        eliminated: false,
        guess: { lat: 1, lng: 2, responseTimeMs: 5_000 }
      }
    }]
  };
}

test("completed game save queue survives retries and removes only confirmed saves", () => {
  const storage = new Map<string, string>();
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value)
    } }
  });

  try {
    enqueueCompletedGameSave(save("queue-test-1"));
    enqueueCompletedGameSave(save("queue-test-1"));
    enqueueCompletedGameSave(save("queue-test-2"));
    assert.deepEqual(readCompletedGameSaves().map((entry) => entry.saveKey), ["queue-test-1", "queue-test-2"]);
    removeCompletedGameSave("queue-test-1");
    assert.deepEqual(readCompletedGameSaves().map((entry) => entry.saveKey), ["queue-test-2"]);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
});
