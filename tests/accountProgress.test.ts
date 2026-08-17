import assert from "node:assert/strict";
import test from "node:test";
import { buildPlayerInsight, distributeProgress, gameProgressBands, nextMilestone } from "../lib/accountProgress";

const rankedStats = {
  count: 3,
  verifiedCount: 3,
  averageRoundScore: 3_500,
  dailyRanking: { rank: 1, participants: 8 },
  weeklyRanking: { rank: 2, participants: 12 },
  strongestCategory: { category: "Städte", value: 3_700, games: 2 }
};

test("motivating account copy is stable throughout a day", () => {
  const morning = buildPlayerInsight("account-123", rankedStats, Date.parse("2026-08-09T08:00:00Z"));
  const evening = buildPlayerInsight("account-123", rankedStats, Date.parse("2026-08-09T22:00:00Z"));
  assert.deepEqual(morning, evening);
});

test("milestones select the next target and calculate progress", () => {
  assert.deepEqual(nextMilestone(6, [1, 5, 10, 25]), { current: 6, target: 10, progress: 60 });
  assert.equal(nextMilestone(25, [1, 5, 10, 25]), null);
});

test("admin progress bands include accounts without games", () => {
  const distribution = distributeProgress([0, 1, 4, 5, 50], gameProgressBands);
  assert.deepEqual(distribution.map((band) => band.count), [1, 2, 1, 0, 0, 1]);
});
