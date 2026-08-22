import assert from "node:assert/strict";
import test from "node:test";
import { enqueueCompletedGameSave, flushCompletedGameSaves, readCompletedGameSaves, removeCompletedGameSave } from "../lib/completedGameSaveQueue.client";

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

test("queued guest games flush in order after authentication", async () => {
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
    enqueueCompletedGameSave(save("guest-result-1"));
    enqueueCompletedGameSave(save("guest-result-2"));
    const attempted: string[] = [];
    const result = await flushCompletedGameSaves(async (input) => {
      attempted.push(input.saveKey);
      return { ok: true, alreadySaved: false };
    });
    assert.deepEqual(attempted, ["guest-result-1", "guest-result-2"]);
    assert.deepEqual(result.savedKeys, attempted);
    assert.deepEqual(readCompletedGameSaves(), []);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
});

test("auth and transient failures retain the queued result", async () => {
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
    enqueueCompletedGameSave(save("guest-result-auth"));
    const auth = await flushCompletedGameSaves(async () => ({ ok: false, code: "auth_required" }));
    assert.equal(auth.authRequired, true);
    assert.deepEqual(readCompletedGameSaves().map((entry) => entry.saveKey), ["guest-result-auth"]);
    await flushCompletedGameSaves(async () => ({ ok: false, code: "save_failed" }));
    assert.deepEqual(readCompletedGameSaves().map((entry) => entry.saveKey), ["guest-result-auth"]);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
});

test("permanently invalid queue entries do not block later games", async () => {
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
    enqueueCompletedGameSave(save("invalid-result"));
    enqueueCompletedGameSave(save("valid-result"));
    const result = await flushCompletedGameSaves(async (input) => input.saveKey === "invalid-result"
      ? { ok: false, code: "invalid" }
      : { ok: true, alreadySaved: false });
    assert.deepEqual(result.discardedInvalidKeys, ["invalid-result"]);
    assert.deepEqual(result.savedKeys, ["valid-result"]);
    assert.deepEqual(readCompletedGameSaves(), []);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
});
