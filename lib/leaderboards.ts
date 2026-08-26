import type { LocationCategory } from "../types/game";
import type { RankedIntegrityStatus } from "./rankedGame";
import type { AccountStatus, ProfileVisibility } from "./accountProfile";

export const leaderboardTimeZone = "Europe/Berlin";

export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "yearly";
export type LeaderboardCategory = LocationCategory | "all";

export type LeaderboardGameResult = {
  gameId: string;
  accountId: string | null;
  publicHandle: string;
  profileStatus: AccountStatus;
  profileVisibility: ProfileVisibility;
  category: LocationCategory;
  rulesetId: string;
  rulesetVersion: number;
  scoringVersion: string;
  integrityStatus: RankedIntegrityStatus;
  score: number;
  /** Optional immutable game settings used to compare different ranked play styles. */
  roundCount?: number;
  roundDurationMs?: number;
  timeLimitSec?: number;
  difficulty?: "easy" | "medium" | "hard";
  noZoom?: boolean;
  comparisonValue?: number;
  totalResponseTimeMs: number;
  completedAt: number;
};

export type LeaderboardQuery = {
  period: LeaderboardPeriod;
  periodKey: string;
  category: LeaderboardCategory;
  rulesetId: string;
  rulesetVersion: number;
  scoringVersion: string;
};

export type LeaderboardEntry = {
  rank: number;
  accountId: string;
  publicHandle: string;
  score: number;
  comparisonValue: number;
  difficulty: "easy" | "medium" | "hard";
  roundDurationMs: number;
  timeLimitSec: number;
  noZoom: boolean;
  gamesCount: number;
  bestScore: number;
  averagePointsPerRound: number;
  roundsPlayed: number;
  totalResponseTimeMs: number;
  latestCompletedAt: number;
  gameIds: string[];
};

export type PublicLeaderboardEntry = Pick<
  LeaderboardEntry,
  "rank" | "publicHandle" | "score" | "gamesCount" | "bestScore" | "totalResponseTimeMs"
> & {
  comparisonValue?: number;
  difficulty?: "easy" | "medium" | "hard";
  roundDurationMs?: number;
  timeLimitSec?: number;
  noZoom?: boolean;
  averagePointsPerRound?: number;
  roundsPlayed?: number;
};

export const comparisonFormulaVersion = "playstyle-v1";

/**
 * Converts the raw average round score into a comparable value.
 * Faster timers, harder location pools and the optional restriction receive
 * a transparent multiplier. Free timers are playable, but are not eligible
 * for the public comparison leaderboard because they have no fixed baseline.
 */
export function calculateComparisonValue(game: Pick<LeaderboardGameResult, "score" | "roundCount" | "roundDurationMs" | "timeLimitSec" | "difficulty" | "noZoom">): number {
  const rounds = Number.isFinite(game.roundCount) && (game.roundCount ?? 0) > 0 ? game.roundCount! : 5;
  const seconds = game.timeLimitSec === 0
    ? Number.POSITIVE_INFINITY
    : Number.isFinite(game.timeLimitSec) && (game.timeLimitSec ?? 0) > 0
      ? game.timeLimitSec!
      : Number.isFinite(game.roundDurationMs) && (game.roundDurationMs ?? 0) > 0 ? game.roundDurationMs! / 1000 : 60;
  const timeFactor = seconds <= 15 ? 1.25 : seconds <= 30 ? 1.1 : 1;
  const difficultyFactor = game.difficulty === "hard" ? 1.15 : game.difficulty === "medium" ? 1.05 : 1;
  const zoomFactor = game.noZoom ? 1.1 : 1;
  return Math.round((game.score / rounds) * timeFactor * difficultyFactor * zoomFactor);
}

function comparisonValue(game: LeaderboardGameResult): number {
  return Number.isFinite(game.comparisonValue)
    ? Math.max(0, Math.round(game.comparisonValue!))
    : calculateComparisonValue(game);
}

const berlinDateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: leaderboardTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function dateParts(timestamp: number): { year: string; month: string; day: string } {
  if (!Number.isFinite(timestamp)) throw new Error("Leaderboard timestamp must be finite.");
  const parts = berlinDateParts.formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) throw new Error("Could not derive leaderboard period in Europe/Berlin.");
  return { year, month, day };
}

export function leaderboardPeriodKey(timestamp: number, period: LeaderboardPeriod): string {
  const { year, month, day } = dateParts(timestamp);
  if (period === "yearly") return year;
  if (period === "monthly") return `${year}-${month}`;
  if (period === "weekly") {
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    const weekday = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - weekday);
    const weekYear = date.getUTCFullYear();
    const yearStart = new Date(Date.UTC(weekYear, 0, 1));
    const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
    return `${weekYear}-W${String(week).padStart(2, "0")}`;
  }
  return `${year}-${month}-${day}`;
}

function betterGame(a: LeaderboardGameResult, b: LeaderboardGameResult): number {
  return comparisonValue(b) - comparisonValue(a) || b.score - a.score || a.totalResponseTimeMs - b.totalResponseTimeMs || a.completedAt - b.completedAt || a.gameId.localeCompare(b.gameId);
}

function entryOrder(a: Omit<LeaderboardEntry, "rank">, b: Omit<LeaderboardEntry, "rank">): number {
  return b.comparisonValue - a.comparisonValue || b.score - a.score || a.totalResponseTimeMs - b.totalResponseTimeMs || a.latestCompletedAt - b.latestCompletedAt || a.accountId.localeCompare(b.accountId);
}

function eligible(game: LeaderboardGameResult, query: LeaderboardQuery): game is LeaderboardGameResult & { accountId: string } {
  return Boolean(
    game.accountId &&
    game.publicHandle.trim() &&
    game.profileStatus === "active" &&
    game.profileVisibility === "public" &&
    game.integrityStatus === "verified" &&
    game.timeLimitSec !== 0 &&
    (query.category === "all" || game.category === query.category) &&
    game.rulesetId === query.rulesetId &&
    game.rulesetVersion === query.rulesetVersion &&
    game.scoringVersion === query.scoringVersion &&
    leaderboardPeriodKey(game.completedAt, query.period) === query.periodKey
  );
}

/**
 * Reference implementation for the product rules. Provider-specific queries
 * must reproduce these results for the same immutable game input.
 */
export function calculateLeaderboard(games: LeaderboardGameResult[], query: LeaderboardQuery): LeaderboardEntry[] {
  const grouped = new Map<string, Array<LeaderboardGameResult & { accountId: string }>>();
  for (const game of games) {
    if (!eligible(game, query)) continue;
    const accountGames = grouped.get(game.accountId) ?? [];
    accountGames.push(game);
    grouped.set(game.accountId, accountGames);
  }

  const entries = Array.from(grouped.entries()).map(([accountId, accountGames]): Omit<LeaderboardEntry, "rank"> => {
    const best = [...accountGames].sort(betterGame)[0];
    return {
      accountId,
      publicHandle: best.publicHandle,
      score: best.score,
      comparisonValue: comparisonValue(best),
      difficulty: best.difficulty ?? "medium",
      roundDurationMs: best.roundDurationMs ?? 60_000,
      timeLimitSec: best.timeLimitSec ?? Math.round((best.roundDurationMs ?? 60_000) / 1000),
      noZoom: best.noZoom ?? false,
      gamesCount: accountGames.length,
      bestScore: best.score,
      averagePointsPerRound: Math.round(best.score / Math.max(1, best.roundCount ?? 5)),
      roundsPlayed: best.roundCount ?? 5,
      totalResponseTimeMs: best.totalResponseTimeMs,
      latestCompletedAt: best.completedAt,
      gameIds: [best.gameId]
    };
  }).sort(entryOrder);

  let previous: Omit<LeaderboardEntry, "rank"> | null = null;
  let previousRank = 0;
  return entries.map((entry, index) => {
    const tied = previous && entry.comparisonValue === previous.comparisonValue && entry.score === previous.score && entry.totalResponseTimeMs === previous.totalResponseTimeMs && entry.latestCompletedAt === previous.latestCompletedAt;
    const rank = tied ? previousRank : index + 1;
    previous = entry;
    previousRank = rank;
    return { rank, ...entry };
  });
}

/** Removes internal account, game and exact activity identifiers from public APIs. */
export function toPublicLeaderboard(entries: LeaderboardEntry[]): PublicLeaderboardEntry[] {
  return entries.map(({ rank, publicHandle, score, comparisonValue, difficulty, roundDurationMs, timeLimitSec, noZoom, gamesCount, bestScore, totalResponseTimeMs, averagePointsPerRound, roundsPlayed }) => ({
    rank,
    publicHandle,
    score,
    comparisonValue,
    difficulty,
    roundDurationMs,
    timeLimitSec,
    noZoom,
    gamesCount,
    bestScore,
    totalResponseTimeMs,
    averagePointsPerRound,
    roundsPlayed
  }));
}
