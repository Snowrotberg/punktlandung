"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";
import type { Json } from "@/lib/supabase/database.types";

export type SaveCompletedGameInput = {
  saveKey: string;
  category: string;
  timeLimitSec: number;
  difficulty: "easy" | "medium" | "hard";
  noZoom: boolean;
  score: number;
  completedRounds: number;
  roundDurationMs: number;
  totalResponseTimeMs: number;
  startedAt: number;
  completedAt: number;
  rounds: Array<{
    roundId: string;
    roundNumber: number;
    locationId: string;
    locationSnapshot: Record<string, unknown>;
    startedAt: number;
    resolvedAt: number;
    result: {
      points: number;
      distanceKm: number;
      badge: string;
      countryCorrect: boolean;
      eliminated: boolean;
      guess: { lat: number; lng: number; countryCode?: string; responseTimeMs?: number } | null;
    };
  }>;
};

type SaveCompletedGameResult =
  | { ok: true; alreadySaved: boolean }
  | { ok: false; code: "auth_required" | "invalid" | "save_failed" };

const categories = new Set(["mixed", "landmarks", "cities", "landscapes", "flags", "capitals", "streetview"]);

function validTimestamp(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= Date.now() + 60_000;
}

function normalizedCountryCode(value: string | undefined): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export async function saveCompletedGame(input: SaveCompletedGameInput): Promise<SaveCompletedGameResult> {
  const context = await getSupabaseAccountContext();
  if (!context) return { ok: false, code: "auth_required" };
  if (!input || !/^[A-Za-z0-9:_-]{8,256}$/.test(input.saveKey) || !categories.has(input.category)) {
    return { ok: false, code: "invalid" };
  }
  if (![0, 15, 30, 60].includes(input.timeLimitSec) || !["easy", "medium", "hard"].includes(input.difficulty) || typeof input.noZoom !== "boolean") {
    return { ok: false, code: "invalid" };
  }
  if (!Number.isFinite(input.score) || input.score < 0 || !Number.isInteger(input.completedRounds) || input.completedRounds < 1 || input.completedRounds > 25) {
    return { ok: false, code: "invalid" };
  }
  if (!Number.isFinite(input.roundDurationMs)) return { ok: false, code: "invalid" };
  if (Math.round(input.score) > input.completedRounds * 5000 || !validTimestamp(input.startedAt) || !validTimestamp(input.completedAt) || input.completedAt < input.startedAt) {
    return { ok: false, code: "invalid" };
  }
  if (!Array.isArray(input.rounds) || input.rounds.length !== input.completedRounds) return { ok: false, code: "invalid" };
  if (input.rounds.some((round, index) =>
    round.roundNumber !== index + 1
    || !round.locationId
    || round.locationId.length > 256
    || !validTimestamp(round.startedAt)
    || !validTimestamp(round.resolvedAt)
    || round.resolvedAt < round.startedAt
    || JSON.stringify(round.locationSnapshot).length > 32_000
    || !round.result
    || !Number.isFinite(round.result.points)
    || round.result.points < 0
    || round.result.points > 5_000
    || !Number.isFinite(round.result.distanceKm)
    || round.result.distanceKm < 0
    || typeof round.result.badge !== "string"
    || round.result.badge.length > 64
    || (round.result.guess != null && (!Number.isFinite(round.result.guess.lat) || !Number.isFinite(round.result.guess.lng) || !Number.isFinite(round.result.guess.responseTimeMs ?? 0) || round.result.guess.lat < -85 || round.result.guess.lat > 85 || round.result.guess.lng < -180 || round.result.guess.lng > 180))
  )) return { ok: false, code: "invalid" };

  const digest = createHash("sha256")
    .update(`${context.identity.account.accountId}:${input.saveKey}`)
    .digest("hex");
  const gameId = `local_${digest.slice(0, 48)}`;
  const createRequestId = `save_${digest}`;
  const now = new Date().toISOString();
  const admin = createSupabaseAdminClient();
  const existing = await admin.from("ranked_games")
    .select("game_id, account_id")
    .eq("create_request_id", createRequestId)
    .maybeSingle();
  if (existing.error) {
    console.error("[saveCompletedGame] idempotency lookup failed", { code: existing.error.code });
    return { ok: false, code: "save_failed" };
  }
  if (existing.data) {
    return existing.data.account_id === context.identity.account.accountId
      ? { ok: true, alreadySaved: true }
      : { ok: false, code: "save_failed" };
  }

  const roundDurationMs = Math.max(1000, Math.min(600_000, Math.round(input.roundDurationMs)));
  const rounds = input.rounds.map((round, index) => ({
    round_id: `${gameId}_${String(index + 1).padStart(2, "0")}`,
    round_number: round.roundNumber,
    location_id: round.locationId,
    location_snapshot: round.locationSnapshot as Json,
    status: "resolved",
    started_at: new Date(round.startedAt).toISOString(),
    deadline_at: new Date(round.startedAt + roundDurationMs).toISOString(),
    resolved_at: new Date(round.resolvedAt).toISOString()
  }));
  const guesses = input.rounds.flatMap((round, index) => {
    if (!round.result.guess) return [];
    const guess = round.result.guess;
    const roundId = rounds[index].round_id;
    const countryCode = normalizedCountryCode(guess.countryCode);
    return [{
      guess_id: `${roundId}_guess`,
      round_id: roundId,
      lat: guess.lat,
      lng: guess.lng,
      country_code: countryCode,
      submitted_at: new Date(round.startedAt + Math.max(0, guess.responseTimeMs ?? 0)).toISOString(),
      response_time_ms: Math.max(0, Math.round(guess.responseTimeMs ?? 0)),
      distance_km: round.result.distanceKm,
      points: Math.round(round.result.points),
      badge: round.result.badge,
      country_correct: round.result.countryCorrect,
      result_snapshot: {
        playerId: context.identity.account.accountId,
        distanceKm: round.result.distanceKm,
        points: Math.round(round.result.points),
        badge: round.result.badge,
        eliminated: round.result.eliminated,
        guess: { lat: guess.lat, lng: guess.lng, countryCode, responseTimeMs: Math.max(0, Math.round(guess.responseTimeMs ?? 0)) },
        countryCorrect: round.result.countryCorrect
      } as Json
    }];
  });

  // Keep the complete save in one database transaction. This prevents a failed
  // round/guess insert from deleting an otherwise valid completed game.
  const persisted = await admin.rpc("persist_ranked_game_state", {
    p_expected_revision: null,
    p_game: {
      game_id: gameId,
      create_request_id: createRequestId,
      account_id: context.identity.account.accountId,
      category: input.category.slice(0, 40),
      time_limit_sec: input.timeLimitSec,
      difficulty: input.difficulty,
      no_zoom: input.noZoom,
      planned_rounds: input.completedRounds,
      completed_rounds: input.completedRounds,
      round_duration_ms: roundDurationMs,
      ruleset_id: "local-game",
      ruleset_version: 1,
      scoring_version: "local-v1",
      score: Math.max(0, Math.round(input.score)),
      total_response_time_ms: Math.max(0, Math.round(input.totalResponseTimeMs)),
      started_at: new Date(input.startedAt).toISOString(),
      completed_at: new Date(input.completedAt).toISOString(),
      claimed_at: now,
      status: "completed",
      integrity_status: "flagged",
      integrity_reasons: ["local_client_result"],
      created_at: now,
      updated_at: now
    },
    p_rounds: rounds,
    p_guesses: guesses
  });
  if (persisted.error) {
    // A double click or two tabs may race. The unique request key makes the
    // second attempt safe; report it as saved when the first one won.
    const retry = await admin.from("ranked_games").select("account_id").eq("create_request_id", createRequestId).maybeSingle();
    if (!retry.error && retry.data?.account_id === context.identity.account.accountId) {
      return { ok: true, alreadySaved: true };
    }
    console.error("[saveCompletedGame] atomic save failed", { code: persisted.error.code });
    return { ok: false, code: "save_failed" };
  }

  revalidatePath("/konto");
  revalidatePath("/konto/verlauf");
  return { ok: true, alreadySaved: false };
}
