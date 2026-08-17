import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryLeaderboardProjectionRepository, LeaderboardProjectionService, leaderboardScopeKey } from "../lib/leaderboardProjectionRepository";
import type { LeaderboardQuery } from "../lib/leaderboards";

const query: LeaderboardQuery = {
  period: "daily", periodKey: "2026-08-03", category: "cities",
  rulesetId: "daily-five", rulesetVersion: 1, scoringVersion: "distance-v1"
};

test("leaderboard scope is deterministic and rejects malformed periods or versions", () => {
  assert.equal(leaderboardScopeKey(query), "daily:2026-08-03:cities:daily-five:1:distance-v1");
  assert.equal(leaderboardScopeKey({ ...query, period: "weekly", periodKey: "2026-W32" }), "weekly:2026-W32:cities:daily-five:1:distance-v1");
  assert.throws(() => leaderboardScopeKey({ ...query, periodKey: "2026-8-3" }));
  assert.throws(() => leaderboardScopeKey({ ...query, rulesetVersion: 0 }));
});

test("projection reads are cloned and capped at one hundred public entries", async () => {
  const repository = new InMemoryLeaderboardProjectionRepository();
  const service = new LeaderboardProjectionService(repository);
  const entries = Array.from({ length: 101 }, (_, index) => ({
    rank: index + 1, publicHandle: `Player${index}`, score: 101 - index,
    gamesCount: 1, bestScore: 101 - index, totalResponseTimeMs: index
  }));
  await repository.replace(query, entries, 1_000);
  const projection = await service.read(query);
  assert.equal(projection?.entries.length, 100);
  if (!projection) throw new Error("missing projection");
  projection.entries[0].score = 0;
  assert.equal((await service.read(query))?.entries[0].score, 101);
  await assert.rejects(service.read(query, 101));
});
