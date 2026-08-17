import assert from "node:assert/strict";
import test from "node:test";
import type { LeaderboardGameResult, LeaderboardQuery, PublicLeaderboardEntry } from "../../lib/leaderboards";

export interface LeaderboardAdapterHarness {
  setGames(games: LeaderboardGameResult[]): Promise<void>;
  rebuild(query: LeaderboardQuery, now: number): Promise<void>;
  read(query: LeaderboardQuery): Promise<PublicLeaderboardEntry[]>;
}

export type LeaderboardAdapterHarnessFactory = () => Promise<LeaderboardAdapterHarness> | LeaderboardAdapterHarness;

const daily: LeaderboardQuery = {
  period: "daily",
  periodKey: "2026-08-03",
  category: "cities",
  rulesetId: "daily-five",
  rulesetVersion: 1,
  scoringVersion: "distance-v1"
};

function game(overrides: Partial<LeaderboardGameResult> = {}): LeaderboardGameResult {
  return {
    gameId: "game-0001",
    accountId: "account-0001",
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

/** Same seeded ranking scenarios must pass against both real providers. */
export function leaderboardAdapterContract(label: string, factory: LeaderboardAdapterHarnessFactory): void {
  test(`${label}: daily projection chooses one best eligible game and redacts internals`, async () => {
    const harness = await factory();
    await harness.setGames([
      game({ gameId: "account-one-low", score: 10_000 }),
      game({ gameId: "account-one-best", score: 22_000 }),
      game({ gameId: "flagged", score: 25_000, integrityStatus: "flagged" }),
      game({ gameId: "private", accountId: "account-private", publicHandle: "Hidden", profileVisibility: "private", score: 25_000 }),
      game({ gameId: "account-two", accountId: "account-0002", publicHandle: "Kompass", score: 21_000 })
    ]);
    await harness.rebuild(daily, 1_000);
    const entries = await harness.read(daily);
    assert.deepEqual(entries.map((entry) => [entry.rank, entry.publicHandle, entry.score]), [
      [1, "Atlas", 22_000],
      [2, "Kompass", 21_000]
    ]);
    const serialized = JSON.stringify(entries);
    assert.equal(serialized.includes("account-"), false);
    assert.equal(serialized.includes("account-one-best"), false);
    for (const entry of entries) {
      assert.deepEqual(Object.keys(entry).sort(), [
        "averagePointsPerRound", "bestScore", "comparisonValue", "difficulty", "gamesCount", "noZoom", "publicHandle", "rank", "roundDurationMs", "roundsPlayed", "score", "timeLimitSec", "totalResponseTimeMs"
      ]);
    }
  });

  test(`${label}: monthly projection uses the best game and counts all eligible attempts`, async () => {
    const harness = await factory();
    const games = Array.from({ length: 12 }, (_, index) => game({
      gameId: `game-${String(index + 1).padStart(4, "0")}`,
      score: 1_000 + index,
      completedAt: Date.parse(`2026-08-${String(index + 1).padStart(2, "0")}T12:00:00Z`)
    }));
    const query = { ...daily, period: "monthly" as const, periodKey: "2026-08" };
    await harness.setGames(games);
    await harness.rebuild(query, 1_000);
    const [entry] = await harness.read(query);
    assert.equal(entry.gamesCount, 12);
    assert.equal(entry.score, 1_011);
  });

  test(`${label}: rebuilding replaces stale entries after invalidation`, async () => {
    const harness = await factory();
    await harness.setGames([game()]);
    await harness.rebuild(daily, 1_000);
    assert.equal((await harness.read(daily)).length, 1);
    await harness.setGames([game({ integrityStatus: "invalid" })]);
    await harness.rebuild(daily, 2_000);
    assert.deepEqual(await harness.read(daily), []);
  });

  test(`${label}: period and category scopes never overwrite each other`, async () => {
    const harness = await factory();
    const flags = { ...daily, category: "flags" as const };
    await harness.setGames([game(), game({ gameId: "flag-game", category: "flags", publicHandle: "Flagger" })]);
    await harness.rebuild(daily, 1_000);
    await harness.rebuild(flags, 1_001);
    assert.deepEqual((await harness.read(daily)).map((entry) => entry.publicHandle), ["Atlas"]);
    assert.deepEqual((await harness.read(flags)).map((entry) => entry.publicHandle), ["Flagger"]);
  });
}
