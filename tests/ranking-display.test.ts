import assert from "node:assert/strict";
import test from "node:test";
import { buildLeaderboardDisplayEntries } from "../lib/leaderboardDisplay";
import { leaderboardPeriodKey, type LeaderboardGameResult, type PublicLeaderboardEntry } from "../lib/leaderboards";
import { findDailyRankedGamePlacement } from "../lib/rankedPlacement";
import { toLeaderboardGameResult, type VerifiedRankedResultRow } from "../lib/verifiedRankedResults";

function publicEntry(rank: number, comparisonValue: number): PublicLeaderboardEntry {
  return {
    rank,
    publicHandle: `Echt ${rank}`,
    score: comparisonValue * 10,
    comparisonValue,
    difficulty: "medium",
    roundDurationMs: 60_000,
    timeLimitSec: 60,
    noZoom: false,
    gamesCount: 1,
    bestScore: comparisonValue * 10,
    totalResponseTimeMs: 10_000,
    averagePointsPerRound: comparisonValue,
    roundsPlayed: 10
  };
}

function game(overrides: Partial<LeaderboardGameResult> = {}): LeaderboardGameResult {
  return {
    gameId: "ranked-current",
    accountId: "account-current",
    publicHandle: "Tim",
    profileStatus: "active",
    profileVisibility: "public",
    category: "mixed",
    rulesetId: "daily-five",
    rulesetVersion: 1,
    scoringVersion: "distance-v1",
    integrityStatus: "verified",
    score: 30_000,
    roundCount: 10,
    roundDurationMs: 60_000,
    timeLimitSec: 60,
    difficulty: "medium",
    noZoom: false,
    totalResponseTimeMs: 50_000,
    completedAt: Date.parse("2026-08-23T12:00:00Z"),
    ...overrides
  };
}

const now = Date.parse("2026-08-24T12:00:00Z");
function displayContext(category: LeaderboardGameResult["category"] = "mixed", period: "daily" | "weekly" | "monthly" | "yearly" = "yearly") {
  return { category, period, periodKey: leaderboardPeriodKey(now, period), now };
}

test("mixed rankings use a fifteen-entry starter field without changing real entries", () => {
  const real = [publicEntry(1, 4300), publicEntry(2, 3900)];
  const displayed = buildLeaderboardDisplayEntries(real, displayContext());
  assert.equal(displayed.length, 15);
  assert.equal(displayed.filter((entry) => !entry.isExample).length, 2);
  assert.deepEqual(displayed.map((entry) => entry.rank), Array.from({ length: 15 }, (_, index) => index + 1));
  assert.deepEqual(displayed.map((entry) => entry.comparisonValue), [...displayed.map((entry) => entry.comparisonValue)].sort((a, b) => (b ?? 0) - (a ?? 0)));
  assert.deepEqual(new Set(displayed.filter((entry) => entry.isExample).map((entry) => entry.timeLimitSec)), new Set([15, 30, 60]));
  assert.equal(new Set(displayed.filter((entry) => entry.isExample).map((entry) => entry.roundsPlayed)).has(18), true);
  assert.equal(new Set(displayed.filter((entry) => entry.isExample).map((entry) => entry.roundsPlayed)).size > 5, true);
  assert.equal(new Set(displayed.filter((entry) => entry.isExample).map((entry) => entry.difficulty)).size, 3);
  assert.equal(displayed.some((entry) => entry.publicHandle === "Timon" || entry.publicHandle === "Kartenkompass"), false);
});

test("starter entries disappear as soon as fifteen real entries exist", () => {
  const real = Array.from({ length: 15 }, (_, index) => publicEntry(index + 1, 5000 - index * 100));
  const displayed = buildLeaderboardDisplayEntries(real, displayContext());
  assert.equal(displayed.length, 15);
  assert.equal(displayed.some((entry) => entry.isExample), false);
});

test("every category has its requested distinct annual starter-field size", () => {
  const expected = { mixed: 15, landmarks: 9, cities: 14, landscapes: 7, flags: 8, capitals: 13 } as const;
  const handles = new Map<string, string>();
  for (const [category, count] of Object.entries(expected) as Array<[keyof typeof expected, number]>) {
    const displayed = buildLeaderboardDisplayEntries([], displayContext(category));
    assert.equal(displayed.length, count, category);
    assert.equal(Math.min(...displayed.map((entry) => entry.comparisonValue ?? 0)) >= 2_300, true, category);
    for (const entry of displayed) {
      assert.equal(handles.has(entry.publicHandle), false, `${entry.publicHandle} must not repeat across categories`);
      handles.set(entry.publicHandle, category);
    }
  }
});

test("period fields build up consistently from today to the year", () => {
  assert.equal(buildLeaderboardDisplayEntries([], displayContext("mixed", "daily")).length, 2);
  assert.equal(buildLeaderboardDisplayEntries([], displayContext("mixed", "weekly")).length, 6);
  assert.equal(buildLeaderboardDisplayEntries([], displayContext("mixed", "monthly")).length, 11);
  assert.equal(buildLeaderboardDisplayEntries([], displayContext("mixed", "yearly")).length, 15);
});

test("every category has a useful weekly and monthly field", () => {
  const expected = {
    mixed: [2, 6, 11, 15], landmarks: [1, 4, 7, 9], cities: [2, 6, 10, 14],
    landscapes: [1, 3, 5, 7], flags: [1, 4, 6, 8], capitals: [2, 5, 9, 13]
  } as const;
  const periods = ["daily", "weekly", "monthly", "yearly"] as const;
  for (const [category, counts] of Object.entries(expected) as Array<[keyof typeof expected, readonly number[]]>) {
    assert.deepEqual(periods.map((period) => buildLeaderboardDisplayEntries([], displayContext(category, period)).length), counts, category);
  }
});

test("a 4,145 starter score can rank ahead of a real 4,123 mixed score", () => {
  const tim = { ...publicEntry(1, 4123), publicHandle: "Tim" };
  const displayed = buildLeaderboardDisplayEntries([tim], displayContext("mixed", "yearly"));
  assert.equal(displayed[0].comparisonValue, 4145);
  assert.equal(displayed[1].publicHandle, "Tim");
  assert.equal(displayed[1].rank, 2);
});

test("a real Timo entry is preserved and never replaced by the starter field", () => {
  const timo = { ...publicEntry(1, 3995), publicHandle: "Timo" };
  const displayed = buildLeaderboardDisplayEntries([timo], displayContext());
  const displayedTimo = displayed.find((entry) => entry.publicHandle === "Timo");
  assert.deepEqual(displayedTimo, { ...timo, rank: 3, isExample: false });
  assert.equal(displayed.filter((entry) => entry.publicHandle === "Timo").length, 1);
});

test("final result placement uses the account's best verified game for that day", () => {
  const games = [
    game({ gameId: "ranked-current", score: 25_000 }),
    game({ gameId: "ranked-best", score: 35_000, completedAt: Date.parse("2026-08-23T13:00:00Z") }),
    game({ gameId: "ranked-winner", accountId: "account-winner", publicHandle: "Atlas", score: 40_000 })
  ];
  const placement = findDailyRankedGamePlacement(games, "ranked-current", "account-current");
  assert.equal(placement?.rank, 2);
  assert.equal(placement?.comparisonValue, 3675);
  assert.equal(placement?.averagePointsPerRound, 3500);
});

test("final result placement rejects a game that does not belong to the account", () => {
  assert.equal(findDailyRankedGamePlacement([game()], "ranked-current", "another-account"), null);
});

test("verified result rows are converted through one shared leaderboard mapping", () => {
  const row: VerifiedRankedResultRow = {
    game_id: "ranked-current",
    account_id: "account-current",
    handle: " Tim ",
    category: "mixed",
    ruleset_id: "daily-five",
    ruleset_version: 1,
    scoring_version: "distance-v1",
    score: 25_000,
    total_response_time_ms: 50_000,
    completed_at: "2026-08-23T12:00:00.000Z",
    planned_rounds: 10,
    time_limit_sec: 60,
    difficulty: "medium",
    no_zoom: false
  };
  assert.deepEqual(toLeaderboardGameResult(row), game({ score: 25_000 }));
});
