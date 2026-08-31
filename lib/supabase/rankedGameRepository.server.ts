import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "./database.types";
import type { RankedGame, RankedGuessCapture, RankedRound } from "@/lib/rankedGame";
import type { RankedGameRepository } from "@/lib/rankedGameRepository";
import type { GeoLocation, RoundResult } from "@/types/game";
import { evaluatePlayerGuess } from "@/lib/roundEvaluation";
import { createSupabaseAdminClient } from "./admin.server";
import type { Database } from "./database.types";

type GameRow = Database["public"]["Tables"]["ranked_games"]["Row"];
type RoundRow = Database["public"]["Tables"]["ranked_rounds"]["Row"];
type GuessRow = Database["public"]["Tables"]["ranked_guesses"]["Row"];
type PersistedRankedLocation = GeoLocation & { __rankedPromptVersion?: number; __rankedCaptures?: RankedGuessCapture[] };

function timestamp(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Supabase returned an invalid ranked-game timestamp.");
  return parsed;
}

function jsonObject<T>(value: Json, label: string): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Supabase returned an invalid ${label}.`);
  }
  return value as T;
}

function mapRound(round: RoundRow, guess: GuessRow | undefined, playerId: string): RankedRound {
  const storedLocation = jsonObject<PersistedRankedLocation>(round.location_snapshot, "ranked location");
  const { __rankedPromptVersion, __rankedCaptures, ...location } = storedLocation;
  const result = guess
    ? jsonObject<RoundResult>(guess.result_snapshot, "ranked result")
    : round.status === "resolved"
      ? evaluatePlayerGuess(playerId, location, null)
      : null;
  return {
    roundId: round.round_id,
    roundNumber: round.round_number,
    status: round.status as RankedRound["status"],
    location,
    startedAt: timestamp(round.started_at),
    deadlineAt: timestamp(round.deadline_at),
    resolvedAt: timestamp(round.resolved_at),
    captures: Array.isArray(__rankedCaptures) ? __rankedCaptures : [],
    guess: guess ? {
      guessId: guess.guess_id,
      roundId: guess.round_id,
      playerId: "guest",
      lat: guess.lat,
      lng: guess.lng,
      countryCode: guess.country_code ?? undefined,
      createdAt: timestamp(guess.submitted_at) as number,
      responseTimeMs: guess.response_time_ms
    } : null,
    result,
    promptVersion: Number.isInteger(__rankedPromptVersion) ? __rankedPromptVersion : 0
  };
}

function mapGame(game: GameRow, rounds: RoundRow[], guesses: GuessRow[]): RankedGame {
  const guessesByRound = new Map(guesses.map((guess) => [guess.round_id, guess]));
  return {
    gameId: game.game_id,
    createRequestId: game.create_request_id,
    guestIdHash: game.guest_id_hash,
    guestExpiresAt: timestamp(game.expires_at),
    accountId: game.account_id,
    status: game.status,
    integrityStatus: game.integrity_status,
    integrityReasons: game.integrity_reasons,
    rulesetId: game.ruleset_id as RankedGame["rulesetId"],
    rulesetVersion: game.ruleset_version as RankedGame["rulesetVersion"],
    scoringVersion: game.scoring_version as RankedGame["scoringVersion"],
    category: game.category as RankedGame["category"],
    roundDurationMs: game.round_duration_ms,
    timeLimitSec: game.time_limit_sec as RankedGame["timeLimitSec"],
    difficulty: game.difficulty as RankedGame["difficulty"],
    noZoom: game.no_zoom,
    startedAt: timestamp(game.started_at) as number,
    completedAt: timestamp(game.completed_at),
    score: game.score,
    totalResponseTimeMs: Number(game.total_response_time_ms),
    rounds: rounds.sort((a, b) => a.round_number - b.round_number).map((round) => mapRound(round, guessesByRound.get(round.round_id), game.account_id ?? "guest"))
  };
}

function iso(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function statePayload(game: RankedGame) {
  const gamePayload = {
    game_id: game.gameId,
    create_request_id: game.createRequestId,
    guest_id_hash: game.guestIdHash,
    account_id: game.accountId,
    status: game.status,
    integrity_status: game.integrityStatus,
    integrity_reasons: game.integrityReasons,
    ruleset_id: game.rulesetId,
    ruleset_version: game.rulesetVersion,
    scoring_version: game.scoringVersion,
    category: game.category,
    round_duration_ms: game.roundDurationMs,
    time_limit_sec: game.timeLimitSec,
    difficulty: game.difficulty,
    no_zoom: game.noZoom,
    planned_rounds: game.rounds.length,
    completed_rounds: game.rounds.filter((round) => round.status === "resolved").length,
    score: game.score,
    total_response_time_ms: game.totalResponseTimeMs,
    started_at: iso(game.startedAt),
    completed_at: iso(game.completedAt),
    claimed_at: game.accountId ? iso(game.completedAt ?? game.startedAt) : null,
    expires_at: game.accountId ? null : iso(game.guestExpiresAt)
  };
  const rounds = game.rounds.map((round) => ({
    round_id: round.roundId,
    round_number: round.roundNumber,
    status: round.status,
    location_id: round.location.id,
    location_snapshot: { ...round.location, __rankedPromptVersion: round.promptVersion ?? 0, __rankedCaptures: round.captures ?? [] },
    started_at: iso(round.startedAt),
    deadline_at: iso(round.deadlineAt),
    resolved_at: iso(round.resolvedAt)
  }));
  const guesses = game.rounds.flatMap((round) => round.guess && round.result ? [{
    guess_id: round.guess.guessId,
    round_id: round.roundId,
    lat: round.guess.lat,
    lng: round.guess.lng,
    country_code: round.guess.countryCode ?? null,
    submitted_at: iso(round.guess.createdAt),
    response_time_ms: round.guess.responseTimeMs,
    distance_km: round.result.distanceKm,
    points: round.result.points,
    badge: round.result.badge,
    country_correct: round.result.countryCorrect,
    result_snapshot: round.result
  }] : []);
  return { game: gamePayload as unknown as Json, rounds: rounds as unknown as Json, guesses: guesses as unknown as Json };
}

export class SupabaseRankedGameRepository implements RankedGameRepository {
  constructor(private readonly client: SupabaseClient<Database> = createSupabaseAdminClient()) {}

  async findById(gameId: string): Promise<RankedGame | null> {
    const { data: game, error } = await this.client.from("ranked_games").select("*").eq("game_id", gameId).maybeSingle();
    if (error) throw new Error("Could not read ranked game from Supabase.");
    if (!game) return null;
    return this.loadState(game);
  }

  async findByCreateRequest(createRequestId: string): Promise<RankedGame | null> {
    const { data: game, error } = await this.client.from("ranked_games").select("*").eq("create_request_id", createRequestId).maybeSingle();
    if (error) throw new Error("Could not read ranked game from Supabase.");
    return game ? this.loadState(game) : null;
  }

  async findLatestActiveByGuestIdHash(guestIdHash: string): Promise<RankedGame | null> {
    const { data: game, error } = await this.client.from("ranked_games")
      .select("*")
      .eq("guest_id_hash", guestIdHash)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Could not recover active ranked game from Supabase.");
    return game ? this.loadState(game) : null;
  }

  async listByAccountId(accountId: string): Promise<RankedGame[]> {
    const { data: games, error } = await this.client.from("ranked_games")
      .select("*")
      .eq("account_id", accountId)
      .order("started_at", { ascending: false });
    if (error) throw new Error("Could not read account ranked games from Supabase.");
    if (games.length === 0) return [];

    const gameIds = games.map((game) => game.game_id);
    const [{ data: rounds, error: roundError }, { data: guesses, error: guessError }] = await Promise.all([
      this.client.from("ranked_rounds").select("*").in("game_id", gameIds),
      this.client.from("ranked_guesses").select("*").in("game_id", gameIds)
    ]);
    if (roundError || guessError) throw new Error("Could not read account ranked game state from Supabase.");

    const roundsByGame = new Map<string, RoundRow[]>();
    const guessesByGame = new Map<string, GuessRow[]>();
    for (const round of rounds) {
      const gameRounds = roundsByGame.get(round.game_id) ?? [];
      gameRounds.push(round);
      roundsByGame.set(round.game_id, gameRounds);
    }
    for (const guess of guesses) {
      const gameGuesses = guessesByGame.get(guess.game_id) ?? [];
      gameGuesses.push(guess);
      guessesByGame.set(guess.game_id, gameGuesses);
    }
    return games.map((game) => mapGame(
      game,
      roundsByGame.get(game.game_id) ?? [],
      guessesByGame.get(game.game_id) ?? []
    ));
  }

  async create(game: RankedGame): Promise<RankedGame> {
    const existing = await this.findByCreateRequest(game.createRequestId);
    if (existing) return existing;
    await this.persist(null, game);
    return (await this.findById(game.gameId)) as RankedGame;
  }

  async updateAtomically(gameId: string, transform: (current: RankedGame) => RankedGame): Promise<RankedGame> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data: row, error } = await this.client.from("ranked_games").select("revision").eq("game_id", gameId).maybeSingle();
      if (error) throw new Error("Could not read ranked game revision from Supabase.");
      if (!row) throw new Error(`Ranked game ${gameId} does not exist.`);
      const current = await this.findById(gameId);
      if (!current) throw new Error(`Ranked game ${gameId} does not exist.`);
      const next = transform(structuredClone(current));
      if (next.gameId !== current.gameId || next.createRequestId !== current.createRequestId) {
        throw new Error("Atomic updates cannot replace ranked game identity.");
      }
      try {
        await this.persist(Number(row.revision), next);
        return (await this.findById(gameId)) as RankedGame;
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("ranked_revision_conflict") || attempt === 3) throw error;
      }
    }
    throw new Error("Could not update ranked game after concurrent writes.");
  }

  async deleteExpiredUnclaimed(now: number, limit: number): Promise<number> {
    if (!Number.isSafeInteger(now) || !Number.isInteger(limit) || limit < 1 || limit > 1_000) throw new Error("Guest cleanup parameters are invalid.");
    const { data, error } = await this.client.from("ranked_games").select("game_id").is("account_id", null).lte("expires_at", new Date(now).toISOString()).limit(limit);
    if (error) throw new Error("Could not find expired ranked games.");
    if (data.length === 0) return 0;
    const deleted = await this.client.from("ranked_games").delete().in("game_id", data.map((row) => row.game_id));
    if (deleted.error) throw new Error("Could not delete expired ranked games.");
    return data.length;
  }

  private async loadState(game: GameRow): Promise<RankedGame> {
    const [{ data: rounds, error: roundError }, { data: guesses, error: guessError }] = await Promise.all([
      this.client.from("ranked_rounds").select("*").eq("game_id", game.game_id),
      this.client.from("ranked_guesses").select("*").eq("game_id", game.game_id)
    ]);
    if (roundError || guessError) throw new Error("Could not read ranked game state from Supabase.");
    return mapGame(game, rounds, guesses);
  }

  private async persist(expectedRevision: number | null, game: RankedGame): Promise<void> {
    const payload = statePayload(game);
    const { error } = await this.client.rpc("persist_ranked_game_state", {
      p_expected_revision: expectedRevision,
      p_game: payload.game,
      p_rounds: payload.rounds,
      p_guesses: payload.guesses
    });
    if (error) throw new Error(error.message);
  }
}
