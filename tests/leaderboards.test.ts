import assert from "node:assert/strict";
import test from "node:test";
import { calculateLeaderboard, leaderboardPeriodKey, toPublicLeaderboard, type LeaderboardGameResult, type LeaderboardQuery } from "../lib/leaderboards";

const baseQuery: LeaderboardQuery = {
  period: "daily",
  periodKey: "2026-08-03",
  category: "cities",
  rulesetId: "daily-five",
  rulesetVersion: 1,
  scoringVersion: "distance-v1"
};

function result(overrides: Partial<LeaderboardGameResult> = {}): LeaderboardGameResult {
  return {
    gameId: "game-1",
    accountId: "account-1",
    publicHandle: "Atlas",
    profileStatus: "active",
    profileVisibility: "public",
    category: "cities",
    rulesetId: "daily-five",
    rulesetVersion: 1,
    scoringVersion: "distance-v1",
    integrityStatus: "verified",
    score: 20_000,
    totalResponseTimeMs: 50_000,
    completedAt: Date.parse("2026-08-03T12:00:00Z"),
    ...overrides
  };
}

test("period keys use Europe/Berlin rather than UTC boundaries", () => {
  const timestamp = Date.parse("2026-08-02T22:30:00Z");
  assert.equal(leaderboardPeriodKey(timestamp, "daily"), "2026-08-03");
  assert.equal(leaderboardPeriodKey(timestamp, "weekly"), "2026-W32");
  assert.equal(leaderboardPeriodKey(timestamp, "monthly"), "2026-08");
  assert.equal(leaderboardPeriodKey(timestamp, "yearly"), "2026");
});

test("daily leaderboard uses only the best verified game per account", () => {
  const games = [
    result({ gameId: "a-low", score: 10_000 }),
    result({ gameId: "a-best", score: 22_000, totalResponseTimeMs: 60_000 }),
    result({ gameId: "a-flagged", score: 25_000, integrityStatus: "flagged" }),
    result({ gameId: "b", accountId: "account-2", publicHandle: "Kompass", score: 21_000, totalResponseTimeMs: 40_000 })
  ];
  const leaderboard = calculateLeaderboard(games, baseQuery);
  assert.deepEqual(leaderboard.map((entry) => [entry.rank, entry.accountId, entry.score, entry.gamesCount]), [
    [1, "account-1", 22_000, 2],
    [2, "account-2", 21_000, 1]
  ]);
  assert.deepEqual(leaderboard[0].gameIds, ["a-best"]);
});

test("monthly leaderboard compares the best game while counting all eligible attempts", () => {
  const games = Array.from({ length: 12 }, (_, index) => result({
    gameId: `game-${index + 1}`,
    score: 1_000 + index,
    completedAt: Date.parse(`2026-08-${String(index + 1).padStart(2, "0")}T12:00:00Z`)
  }));
  const leaderboard = calculateLeaderboard(games, { ...baseQuery, period: "monthly", periodKey: "2026-08" });
  assert.equal(leaderboard[0].gamesCount, 12);
  assert.equal(leaderboard[0].score, 1_011);
  assert.deepEqual(leaderboard[0].gameIds, ["game-12"]);
});

test("query separates categories and incompatible versions", () => {
  const games = [
    result({ gameId: "valid" }),
    result({ gameId: "flags", category: "flags", score: 25_000 }),
    result({ gameId: "old-rules", rulesetVersion: 0, score: 25_000 }),
    result({ gameId: "old-score", scoringVersion: "old", score: 25_000 }),
    result({ gameId: "anonymous", accountId: null, score: 25_000 }),
    result({ gameId: "missing-handle", publicHandle: "", score: 25_000 }),
    result({ gameId: "private", profileVisibility: "private", score: 25_000 }),
    result({ gameId: "deleted", profileStatus: "deleted", score: 25_000 })
  ];
  assert.deepEqual(calculateLeaderboard(games, baseQuery).map((entry) => entry.gameIds), [["valid"]]);
});

test("overall ranking keeps each account once with its best game across categories", () => {
  const games = [
    result({ gameId: "a-city", score: 20_000 }),
    result({ gameId: "a-flag", category: "flags", score: 24_000 }),
    result({ gameId: "b-landmark", accountId: "account-2", publicHandle: "Kompass", category: "landmarks", score: 22_000 })
  ];
  const leaderboard = calculateLeaderboard(games, { ...baseQuery, category: "all" });
  assert.deepEqual(leaderboard.map((entry) => [entry.accountId, entry.score, entry.gamesCount]), [
    ["account-1", 24_000, 2],
    ["account-2", 22_000, 1]
  ]);
  assert.deepEqual(leaderboard[0].gameIds, ["a-flag"]);
});

test("score ties use response time and then completion time", () => {
  const games = [
    result({ gameId: "slow", accountId: "slow", publicHandle: "Slow", totalResponseTimeMs: 60_000 }),
    result({ gameId: "later", accountId: "later", publicHandle: "Later", totalResponseTimeMs: 40_000, completedAt: Date.parse("2026-08-03T13:00:00Z") }),
    result({ gameId: "early", accountId: "early", publicHandle: "Early", totalResponseTimeMs: 40_000, completedAt: Date.parse("2026-08-03T11:00:00Z") })
  ];
  const leaderboard = calculateLeaderboard(games, baseQuery);
  assert.deepEqual(leaderboard.map((entry) => entry.accountId), ["early", "later", "slow"]);
  assert.deepEqual(leaderboard.map((entry) => entry.rank), [1, 2, 3]);
});

test("public projection removes internal account, game and activity identifiers", () => {
  const internal = calculateLeaderboard([
    result({ gameId: "private-game-id", accountId: "private-account-id" })
  ], baseQuery);
  const projected = toPublicLeaderboard(internal);
  assert.deepEqual(Object.keys(projected[0]).sort(), [
    "averagePointsPerRound", "bestScore", "comparisonValue", "difficulty", "gamesCount", "noZoom", "publicHandle", "rank", "roundDurationMs", "roundsPlayed", "score", "timeLimitSec", "totalResponseTimeMs"
  ]);
  const serialized = JSON.stringify(projected);
  assert.equal(serialized.includes("private-game-id"), false);
  assert.equal(serialized.includes("private-account-id"), false);
});
