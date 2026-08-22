import assert from "node:assert/strict";
import test from "node:test";
import { enqueueRankedGameClaim, readPendingRankedGameClaims, removeRankedGameClaim } from "../lib/rankedGameClaimQueue.client";

test("ranked claim intent survives navigation and is idempotent", () => {
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
    enqueueRankedGameClaim("ranked-game-0001");
    enqueueRankedGameClaim("ranked-game-0001");
    assert.deepEqual(readPendingRankedGameClaims(), ["ranked-game-0001"]);
    removeRankedGameClaim("ranked-game-0001");
    assert.deepEqual(readPendingRankedGameClaims(), []);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
});

test("ranked claim queue rejects malformed identifiers and stays bounded", () => {
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
    enqueueRankedGameClaim("bad id");
    for (let index = 0; index < 7; index += 1) enqueueRankedGameClaim(`ranked-game-${index.toString().padStart(4, "0")}`);
    assert.deepEqual(readPendingRankedGameClaims(), [
      "ranked-game-0002",
      "ranked-game-0003",
      "ranked-game-0004",
      "ranked-game-0005",
      "ranked-game-0006"
    ]);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
});
