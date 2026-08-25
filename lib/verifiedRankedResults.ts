import type { LocationCategory } from "@/types/game";
import type { LeaderboardGameResult } from "@/lib/leaderboards";
import type { Database } from "@/lib/supabase/database.types";

export const verifiedRankedResultsSelect = "game_id, account_id, handle, category, ruleset_id, ruleset_version, scoring_version, score, total_response_time_ms, completed_at, planned_rounds, time_limit_sec, difficulty, no_zoom";

export type VerifiedRankedResultRow = Database["public"]["Views"]["verified_ranked_results"]["Row"];

const locationCategories = new Set<LocationCategory>([
  "mixed",
  "landmarks",
  "cities",
  "landscapes",
  "flags",
  "capitals",
  "streetview"
]);

export function toLeaderboardGameResult(row: VerifiedRankedResultRow): LeaderboardGameResult | null {
  const completedAt = row.completed_at ? Date.parse(row.completed_at) : Number.NaN;
  if (
    !row.game_id
    || !row.account_id
    || !row.handle?.trim()
    || !row.category
    || !locationCategories.has(row.category as LocationCategory)
    || !row.ruleset_id
    || row.ruleset_version == null
    || !row.scoring_version
    || row.score == null
    || row.total_response_time_ms == null
    || !Number.isFinite(completedAt)
  ) return null;

  const timeLimitSec = row.time_limit_sec ?? 60;
  return {
    gameId: row.game_id,
    accountId: row.account_id,
    publicHandle: row.handle.trim(),
    profileStatus: "active",
    profileVisibility: "public",
    category: row.category as LocationCategory,
    rulesetId: row.ruleset_id,
    rulesetVersion: row.ruleset_version,
    scoringVersion: row.scoring_version,
    integrityStatus: "verified",
    score: row.score,
    totalResponseTimeMs: row.total_response_time_ms,
    roundCount: row.planned_rounds ?? undefined,
    timeLimitSec,
    roundDurationMs: timeLimitSec === 0 ? 600_000 : timeLimitSec * 1000,
    difficulty: row.difficulty === "easy" || row.difficulty === "hard" ? row.difficulty : "medium",
    noZoom: Boolean(row.no_zoom),
    completedAt
  };
}

export function toLeaderboardGameResults(rows: VerifiedRankedResultRow[]): LeaderboardGameResult[] {
  return rows.flatMap((row) => {
    const game = toLeaderboardGameResult(row);
    return game ? [game] : [];
  });
}
