import assert from "node:assert/strict";
import test from "node:test";
import { consumeDirectRankedStart, queueDirectRankedStart } from "../lib/directRankedStart.client";
import type { PublicRankedGame } from "../lib/rankedGame";
import type { GameSettings } from "../types/game";

const settings: GameSettings = {
  mode: "classic",
  localMode: "solo",
  localPlayerCount: 1,
  timeLimitSec: 60,
  rounds: 15,
  noMove: false,
  noPan: false,
  noZoom: false,
  mapPackId: "world",
  category: "mixed",
  difficulty: "medium"
};

function withSessionStorage(run: (storage: Map<string, string>) => void) {
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
    run(storage);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
}

test("direct ranked start crosses exactly one route transition", () => {
  withSessionStorage(() => {
    queueDirectRankedStart({ game: { gameId: "ranked-direct-0001" } as PublicRankedGame, name: "Spieler 1", settings });
    assert.equal(consumeDirectRankedStart()?.game.gameId, "ranked-direct-0001");
    assert.equal(consumeDirectRankedStart(), null);
  });
});

test("stale direct starts cannot hijack a later game route", () => {
  const realNow = Date.now;
  let now = 10_000;
  Date.now = () => now;
  try {
    withSessionStorage(() => {
      queueDirectRankedStart({ game: { gameId: "ranked-direct-0002" } as PublicRankedGame, name: "Spieler 1", settings });
      now += 60_001;
      assert.equal(consumeDirectRankedStart(), null);
    });
  } finally {
    Date.now = realNow;
  }
});
