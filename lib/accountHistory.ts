import { calculateComparisonValue } from "./leaderboards";

export const accountHistoryCategories = ["mixed", "landmarks", "cities", "landscapes", "flags", "capitals"] as const;

export type AccountHistoryCategory = "all" | (typeof accountHistoryCategories)[number];
export type AccountHistorySort = "latest" | "average" | "score";

export type AccountHistoryGame = {
  game_id: string;
  category: string;
  score: number | null;
  completed_at: string | null;
  integrity_status: string;
  integrity_reasons?: string[] | null;
  planned_rounds: number | null;
  completed_rounds: number | null;
  time_limit_sec: number | null;
  difficulty: string | null;
  no_zoom: boolean | null;
  total_response_time_ms: number | null;
};

export function parseAccountHistoryCategory(value: string | undefined): AccountHistoryCategory {
  return value === "all" || accountHistoryCategories.some((category) => category === value) ? value as AccountHistoryCategory : "all";
}

export function parseAccountHistorySort(value: string | undefined): AccountHistorySort {
  return value === "average" || value === "score" ? value : "latest";
}

function completedRounds(game: AccountHistoryGame): number {
  return Math.max(0, game.completed_rounds ?? game.planned_rounds ?? 0);
}

function rawAverage(game: AccountHistoryGame): number {
  return (game.score ?? 0) / Math.max(1, completedRounds(game));
}

function completedAt(game: AccountHistoryGame): number {
  const timestamp = game.completed_at ? Date.parse(game.completed_at) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function accountHistoryComparisonValue(game: AccountHistoryGame): number | null {
  if (game.integrity_status !== "verified") return null;
  const rounds = completedRounds(game);
  return calculateComparisonValue({
    score: game.score ?? 0,
    roundCount: rounds,
    timeLimitSec: game.time_limit_sec ?? undefined,
    difficulty: game.difficulty === "easy" || game.difficulty === "hard" ? game.difficulty : "medium",
    noZoom: Boolean(game.no_zoom)
  });
}

export function filterAndSortAccountHistory(
  games: AccountHistoryGame[],
  category: AccountHistoryCategory,
  sort: AccountHistorySort
): AccountHistoryGame[] {
  const filtered = category === "all" ? games : games.filter((game) => game.category === category);
  return [...filtered].sort((left, right) => {
    if (sort === "score") return (right.score ?? 0) - (left.score ?? 0) || completedAt(right) - completedAt(left) || left.game_id.localeCompare(right.game_id);
    if (sort === "average") return rawAverage(right) - rawAverage(left) || completedAt(right) - completedAt(left) || left.game_id.localeCompare(right.game_id);
    return completedAt(right) - completedAt(left) || left.game_id.localeCompare(right.game_id);
  });
}
