import {
  calculateLeaderboard,
  toPublicLeaderboard,
  type LeaderboardGameResult,
  type LeaderboardQuery,
  type PublicLeaderboardEntry
} from "./leaderboards";

export type LeaderboardProjection = {
  scopeKey: string;
  calculatedAt: number;
  entries: PublicLeaderboardEntry[];
};

const categories = new Set(["mixed", "landmarks", "cities", "landscapes", "flags", "capitals", "streetview"]);

export function leaderboardScopeKey(query: LeaderboardQuery): string {
  const validPeriod = query.period === "daily"
    ? /^\d{4}-\d{2}-\d{2}$/.test(query.periodKey)
    : query.period === "weekly"
      ? /^\d{4}-W\d{2}$/.test(query.periodKey)
    : query.period === "monthly"
      ? /^\d{4}-\d{2}$/.test(query.periodKey)
      : /^\d{4}$/.test(query.periodKey);
  if (!validPeriod || !categories.has(query.category)
    || !/^[a-z0-9-]{1,64}$/.test(query.rulesetId)
    || !Number.isInteger(query.rulesetVersion) || query.rulesetVersion < 1
    || !/^[a-z0-9-]{1,64}$/.test(query.scoringVersion)) {
    throw new Error("Leaderboard scope is invalid.");
  }
  return [query.period, query.periodKey, query.category, query.rulesetId, query.rulesetVersion, query.scoringVersion].join(":");
}

/** Atomic precomputed projection port used by either database adapter. */
export interface LeaderboardProjectionRepository {
  replace(query: LeaderboardQuery, entries: PublicLeaderboardEntry[], calculatedAt: number): Promise<LeaderboardProjection>;
  read(query: LeaderboardQuery): Promise<LeaderboardProjection | null>;
}

export class InMemoryLeaderboardProjectionRepository implements LeaderboardProjectionRepository {
  private readonly projections = new Map<string, LeaderboardProjection>();

  async replace(query: LeaderboardQuery, entries: PublicLeaderboardEntry[], calculatedAt: number): Promise<LeaderboardProjection> {
    if (!Number.isFinite(calculatedAt)) throw new Error("Leaderboard calculation time is invalid.");
    const scopeKey = leaderboardScopeKey(query);
    const projection = structuredClone({ scopeKey, calculatedAt, entries });
    this.projections.set(scopeKey, projection);
    return structuredClone(projection);
  }

  async read(query: LeaderboardQuery): Promise<LeaderboardProjection | null> {
    const projection = this.projections.get(leaderboardScopeKey(query));
    return projection ? structuredClone(projection) : null;
  }
}

export class LeaderboardProjectionService {
  constructor(private readonly repository: LeaderboardProjectionRepository) {}

  async rebuild(games: LeaderboardGameResult[], query: LeaderboardQuery, now: number): Promise<LeaderboardProjection> {
    return this.repository.replace(query, toPublicLeaderboard(calculateLeaderboard(games, query)), now);
  }

  async read(query: LeaderboardQuery, limit = 100): Promise<LeaderboardProjection | null> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Leaderboard limit must be between 1 and 100.");
    const projection = await this.repository.read(query);
    return projection ? { ...projection, entries: projection.entries.slice(0, limit) } : null;
  }
}
