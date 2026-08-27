import assert from "node:assert/strict";
import test from "node:test";
import { summarizeGameplayTypes } from "../lib/adminGameplayStatistics";
import type { UsageEvent } from "../lib/usageMetrics.server";

function event(gameType?: UsageEvent["gameType"], name: UsageEvent["event"] = "game_start"): UsageEvent {
  return { version: 1, at: "2026-08-27T08:00:00.000Z", event: name, gameType };
}

test("gameplay statistics count starts by player-facing game type", () => {
  const rows = summarizeGameplayTypes([
    event("solo"), event("solo"), event("party"), event("online"), event("online"), event("online"),
    event("solo", "game_complete")
  ]);
  assert.deepEqual(rows, [
    { key: "solo", label: "Solo", count: 2, share: 33 },
    { key: "party", label: "Party an einem Gerät", count: 1, share: 17 },
    { key: "online", label: "Online-Raum", count: 3, share: 50 }
  ]);
});

test("legacy starts remain visible instead of being silently dropped", () => {
  assert.deepEqual(summarizeGameplayTypes([event(undefined)]).at(-1), {
    key: "unknown", label: "Nicht zugeordnet", count: 1, share: 100
  });
});

test("empty periods show supported game types without artificial percentages", () => {
  assert.deepEqual(summarizeGameplayTypes([]).map(({ count, share }) => ({ count, share })), [
    { count: 0, share: null }, { count: 0, share: null }, { count: 0, share: null }
  ]);
});
