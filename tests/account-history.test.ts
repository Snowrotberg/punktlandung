import assert from "node:assert/strict";
import test from "node:test";
import {
  filterAndSortAccountHistory,
  parseAccountHistoryCategory,
  parseAccountHistorySort,
  type AccountHistoryGame
} from "../lib/accountHistory";

function game(overrides: Partial<AccountHistoryGame> = {}): AccountHistoryGame {
  return {
    game_id: "game-1",
    category: "mixed",
    score: 20_000,
    completed_at: "2026-08-26T12:00:00.000Z",
    integrity_status: "verified",
    planned_rounds: 10,
    completed_rounds: 10,
    time_limit_sec: 60,
    difficulty: "medium",
    no_zoom: false,
    total_response_time_ms: 50_000,
    ...overrides
  };
}

test("history filters one category without changing the original list", () => {
  const games = [game(), game({ game_id: "city", category: "cities" }), game({ game_id: "flag", category: "flags" })];
  assert.deepEqual(filterAndSortAccountHistory(games, "cities", "latest").map((entry) => entry.game_id), ["city"]);
  assert.equal(games.length, 3);
});

test("history sorting separates newest, average and total score", () => {
  const games = [
    game({ game_id: "new", score: 10_000, completed_at: "2026-08-26T12:00:00.000Z" }),
    game({ game_id: "average", score: 18_000, completed_rounds: 5, planned_rounds: 5, completed_at: "2026-08-24T12:00:00.000Z" }),
    game({ game_id: "total", score: 30_000, completed_rounds: 20, planned_rounds: 20, completed_at: "2026-08-25T12:00:00.000Z" })
  ];
  assert.deepEqual(filterAndSortAccountHistory(games, "all", "latest").map((entry) => entry.game_id), ["new", "total", "average"]);
  assert.deepEqual(filterAndSortAccountHistory(games, "all", "average").map((entry) => entry.game_id), ["average", "total", "new"]);
  assert.deepEqual(filterAndSortAccountHistory(games, "all", "score").map((entry) => entry.game_id), ["total", "average", "new"]);
});

test("unknown history query values fall back safely", () => {
  assert.equal(parseAccountHistoryCategory("streetview"), "all");
  assert.equal(parseAccountHistoryCategory("flags"), "flags");
  assert.equal(parseAccountHistorySort("unknown"), "latest");
  assert.equal(parseAccountHistorySort("average"), "average");
});
