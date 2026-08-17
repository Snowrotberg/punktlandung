import assert from "node:assert/strict";
import test from "node:test";
import { LeaderboardHttpApi } from "../lib/leaderboardHttp.server";
import { InMemoryLeaderboardProjectionRepository, LeaderboardProjectionService } from "../lib/leaderboardProjectionRepository";
import type { LeaderboardQuery } from "../lib/leaderboards";

const query: LeaderboardQuery = {
  period: "daily", periodKey: "2026-08-03", category: "cities",
  rulesetId: "daily-five", rulesetVersion: 1, scoringVersion: "distance-v1"
};

function url(overrides: Record<string, string> = {}): string {
  const parameters = new URLSearchParams({
    period: query.period,
    periodKey: query.periodKey,
    category: query.category,
    rulesetId: query.rulesetId,
    rulesetVersion: String(query.rulesetVersion),
    scoringVersion: query.scoringVersion,
    ...overrides
  });
  return `https://punktlandung.example/api/v1/leaderboards?${parameters}`;
}

async function readyApi() {
  const repository = new InMemoryLeaderboardProjectionRepository();
  const service = new LeaderboardProjectionService(repository);
  await repository.replace(query, [{
    rank: 1, publicHandle: "Atlas", score: 20_000, gamesCount: 1,
    bestScore: 20_000, totalResponseTimeMs: 50_000
  }], 1_000);
  return new LeaderboardHttpApi(service, { check: async () => ({ allowed: true }) });
}

test("leaderboard HTTP returns only the redacted cached projection", async () => {
  const api = await readyApi();
  const response = await api.get(new Request(url()));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=30, stale-while-revalidate=60");
  const raw = await response.text();
  assert.equal(raw.includes("accountId"), false);
  assert.equal(raw.includes("gameIds"), false);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.data.entries[0].publicHandle, "Atlas");
});

test("leaderboard HTTP rejects duplicate, unknown and malformed scope parameters", async () => {
  const api = await readyApi();
  assert.equal((await api.get(new Request(`${url()}&period=daily`))).status, 400);
  assert.equal((await api.get(new Request(`${url()}&accountId=private`))).status, 400);
  assert.equal((await api.get(new Request(url({ periodKey: "2026-8-3" })))).status, 400);
  assert.equal((await api.get(new Request(url({ limit: "101" })))).status, 400);
});

test("leaderboard HTTP applies public rate limits and does not synthesize missing data", async () => {
  const service = new LeaderboardProjectionService(new InMemoryLeaderboardProjectionRepository());
  const missing = new LeaderboardHttpApi(service, { check: async () => ({ allowed: true }) });
  assert.equal((await missing.get(new Request(url()))).status, 404);
  const limited = new LeaderboardHttpApi(service, { check: async () => ({ allowed: false, retryAfterSeconds: 15 }) });
  const response = await limited.get(new Request(url()));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "15");
});
