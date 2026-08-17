import { leaderboardScopeKey, type LeaderboardProjectionService } from "./leaderboardProjectionRepository";
import type { LeaderboardPeriod, LeaderboardQuery } from "./leaderboards";
import type { LocationCategory } from "../types/game";

const allowedParameters = new Set(["period", "periodKey", "category", "rulesetId", "rulesetVersion", "scoringVersion", "limit"]);

export interface LeaderboardRequestGuard {
  check(request: Request): Promise<{ allowed: boolean; retryAfterSeconds?: number }>;
}

class LeaderboardHttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly headers?: HeadersInit) {
    super(message);
    this.name = "LeaderboardHttpError";
  }
}

function json(status: number, body: unknown, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function one(parameters: URLSearchParams, name: string): string {
  const values = parameters.getAll(name);
  if (values.length !== 1 || !values[0]) throw new LeaderboardHttpError(400, "invalid_query", `${name} is required exactly once.`);
  return values[0];
}

export class LeaderboardHttpApi {
  constructor(
    private readonly service: LeaderboardProjectionService,
    private readonly requestGuard: LeaderboardRequestGuard
  ) {}

  async get(request: Request): Promise<Response> {
    try {
      if (request.method !== "GET") throw new LeaderboardHttpError(405, "method_not_allowed", "Only GET is allowed.", { allow: "GET" });
      const guard = await this.requestGuard.check(request);
      if (!guard.allowed) {
        const retryAfter = Math.max(1, Math.min(3_600, Math.floor(guard.retryAfterSeconds ?? 60)));
        throw new LeaderboardHttpError(429, "rate_limited", "Too many requests.", { "retry-after": String(retryAfter) });
      }
      const parameters = new URL(request.url).searchParams;
      for (const key of parameters.keys()) {
        if (!allowedParameters.has(key)) throw new LeaderboardHttpError(400, "invalid_query", "Unknown query parameter.");
      }
      const period = one(parameters, "period") as LeaderboardPeriod;
      if (period !== "daily" && period !== "weekly" && period !== "monthly" && period !== "yearly") {
        throw new LeaderboardHttpError(400, "invalid_query", "period is invalid.");
      }
      const query: LeaderboardQuery = {
        period,
        periodKey: one(parameters, "periodKey"),
        category: one(parameters, "category") as LocationCategory,
        rulesetId: one(parameters, "rulesetId"),
        rulesetVersion: Number(one(parameters, "rulesetVersion")),
        scoringVersion: one(parameters, "scoringVersion")
      };
      let scopeKey: string;
      try {
        scopeKey = leaderboardScopeKey(query);
      } catch {
        throw new LeaderboardHttpError(400, "invalid_query", "Leaderboard scope is invalid.");
      }
      const rawLimit = parameters.get("limit");
      const limit = rawLimit === null ? 100 : Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new LeaderboardHttpError(400, "invalid_query", "limit must be between 1 and 100.");
      }
      const projection = await this.service.read(query, limit);
      if (!projection) throw new LeaderboardHttpError(404, "leaderboard_not_ready", "Leaderboard is not available yet.");
      return json(200, {
        data: {
          scopeKey,
          calculatedAt: projection.calculatedAt,
          entries: projection.entries
        }
      }, { "cache-control": "public, max-age=30, stale-while-revalidate=60" });
    } catch (error) {
      if (error instanceof LeaderboardHttpError) {
        return json(error.status, { error: { code: error.code, message: error.message } }, error.headers);
      }
      return json(500, { error: { code: "internal_error", message: "The leaderboard could not be loaded." } }, { "cache-control": "no-store" });
    }
  }
}
