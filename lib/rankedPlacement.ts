import { calculateLeaderboard, leaderboardPeriodKey, type LeaderboardGameResult } from "@/lib/leaderboards";

export type RankedGamePlacement = {
  rank: number;
  comparisonValue: number;
  averagePointsPerRound: number;
  category: LeaderboardGameResult["category"];
  periodKey: string;
};

export function findDailyRankedGamePlacement(
  games: LeaderboardGameResult[],
  gameId: string,
  accountId: string
): RankedGamePlacement | null {
  const game = games.find((entry) => entry.gameId === gameId && entry.accountId === accountId);
  if (!game) return null;

  const periodKey = leaderboardPeriodKey(game.completedAt, "daily");
  const entries = calculateLeaderboard(games, {
    period: "daily",
    periodKey,
    category: game.category,
    rulesetId: game.rulesetId,
    rulesetVersion: game.rulesetVersion,
    scoringVersion: game.scoringVersion
  });
  const ownEntry = entries.find((entry) => entry.accountId === accountId);
  if (!ownEntry) return null;

  return {
    rank: ownEntry.rank,
    comparisonValue: ownEntry.comparisonValue,
    averagePointsPerRound: ownEntry.averagePointsPerRound,
    category: game.category,
    periodKey
  };
}
