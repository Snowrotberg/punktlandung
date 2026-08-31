import { evaluatePlayerGuess } from "./roundEvaluation";
import type { GeoLocation, Guess, LatLng, LocationCategory, RoundResult } from "../types/game";

export const rankedRulesetId = "daily-five";
export const rankedRulesetVersion = 1;
export const rankedScoringVersion = "distance-v1";
export const rankedGuestRetentionMs = 72 * 60 * 60 * 1000;

export type RankedIntegrityStatus = "verified" | "flagged" | "invalid";
export type RankedGameStatus = "active" | "completed";
export type RankedRoundStatus = "pending" | "open" | "resolved";

export type RankedGuess = Guess & {
  guessId: string;
  roundId: string;
};

export type RankedGuessCapture = {
  guessId: string;
  roundId: string;
  lat: number;
  lng: number;
  countryCode?: string;
  capturedAt: number;
};

export type RankedRound = {
  roundId: string;
  roundNumber: number;
  status: RankedRoundStatus;
  /** Server-private answer. Never serialize this object directly to a client. */
  location: GeoLocation;
  startedAt: number | null;
  deadlineAt: number | null;
  resolvedAt: number | null;
  captures?: RankedGuessCapture[];
  guess: RankedGuess | null;
  result: RoundResult | null;
  promptVersion?: number;
};

export type RankedGame = {
  gameId: string;
  createRequestId: string;
  guestIdHash: string | null;
  guestExpiresAt: number | null;
  accountId: string | null;
  status: RankedGameStatus;
  integrityStatus: RankedIntegrityStatus;
  integrityReasons: string[];
  rulesetId: typeof rankedRulesetId;
  rulesetVersion: typeof rankedRulesetVersion;
  scoringVersion: typeof rankedScoringVersion;
  category: LocationCategory;
  roundDurationMs: number;
  timeLimitSec?: 0 | 15 | 30 | 60;
  difficulty?: "easy" | "medium" | "hard";
  noZoom?: boolean;
  startedAt: number;
  completedAt: number | null;
  score: number;
  totalResponseTimeMs: number;
  rounds: RankedRound[];
};

export type PublicRankedRoundPrompt = {
  roundId: string;
  roundNumber: number;
  totalRounds: number;
  category: LocationCategory;
  /** Opaque same-origin endpoint; it must not reveal a catalogue ID or answer. */
  assetUrl: string;
  startedAt: number | null;
  deadlineAt: number | null;
};

export type PublicResolvedRankedRound = {
  roundId: string;
  roundNumber: number;
  location: {
    title: string;
    countryCode: string;
    countryName: string;
    continent: string;
    lat: number;
    lng: number;
    category: LocationCategory;
    imageFile?: string;
    shortDescription?: string;
    descriptionSourceUrl?: string;
  };
  result: RoundResult;
  resolvedAt: number;
};

export type PublicRankedGame = {
  gameId: string;
  status: RankedGameStatus;
  integrityStatus: RankedIntegrityStatus;
  rulesetId: string;
  rulesetVersion: number;
  scoringVersion: string;
  category: LocationCategory;
  score: number;
  totalResponseTimeMs: number;
  activeRound: PublicRankedRoundPrompt | null;
  resolvedRounds: PublicResolvedRankedRound[];
  completedAt: number | null;
  claimed: boolean;
  timeLimitSec?: 0 | 15 | 30 | 60;
  difficulty?: "easy" | "medium" | "hard";
  noZoom?: boolean;
};

export type RankedGameErrorCode =
  | "invalid_game"
  | "invalid_guess"
  | "game_completed"
  | "round_not_open"
  | "round_mismatch"
  | "round_expired"
  | "capture_required"
  | "capture_conflict"
  | "guess_conflict"
  | "game_not_completed"
  | "claim_conflict";

export class RankedGameError extends Error {
  constructor(readonly code: RankedGameErrorCode, message: string) {
    super(message);
    this.name = "RankedGameError";
  }
}

export type CreateRankedGameInput = {
  gameId: string;
  createRequestId: string;
  guestIdHash: string;
  locations: GeoLocation[];
  category?: LocationCategory;
  roundIds: string[];
  now: number;
  roundDurationMs: number;
  timeLimitSec?: 0 | 15 | 30 | 60;
  difficulty?: "easy" | "medium" | "hard";
  noZoom?: boolean;
  deferRoundStart?: boolean;
};

function uniqueStrings(values: string[]): boolean {
  return new Set(values).size === values.length && values.every((value) => value.trim().length > 0);
}

function assertCreateInput(input: CreateRankedGameInput): void {
  if (!input.gameId || !input.createRequestId || !input.guestIdHash) {
    throw new RankedGameError("invalid_game", "Game, request and guest identifiers are required.");
  }
  if (input.locations.length === 0 || input.locations.length !== input.roundIds.length || !uniqueStrings(input.roundIds)) {
    throw new RankedGameError("invalid_game", "Locations and unique round identifiers must have equal non-zero length.");
  }
  const timeLimitSec = input.timeLimitSec ?? (Math.round(input.roundDurationMs / 1000) as 0 | 15 | 30 | 60);
  const difficulty = input.difficulty ?? "medium";
  const noZoom = input.noZoom ?? false;
  if (!Number.isFinite(input.now) || !Number.isFinite(input.roundDurationMs) || input.roundDurationMs < 1000 || ![0, 15, 30, 60].includes(timeLimitSec) || !["easy", "medium", "hard"].includes(difficulty)) {
    throw new RankedGameError("invalid_game", "Start time and round duration are invalid.");
  }
}

function openRound(round: RankedRound, now: number, durationMs: number): RankedRound {
  return {
    ...round,
    status: "open",
    startedAt: now,
    deadlineAt: now + durationMs
  };
}

export function createRankedGame(input: CreateRankedGameInput): RankedGame {
  assertCreateInput(input);
  const timeLimitSec = input.timeLimitSec ?? (Math.round(input.roundDurationMs / 1000) as 0 | 15 | 30 | 60);
  const difficulty = input.difficulty ?? "medium";
  const noZoom = input.noZoom ?? false;
  const categories = new Set(input.locations.map((location) => location.category));
  const category = input.category ?? (categories.size === 1 ? [...categories][0] : "mixed");
  const rounds = input.locations.map((location, index): RankedRound => ({
    roundId: input.roundIds[index],
    roundNumber: index + 1,
    status: "pending",
    location,
    startedAt: null,
    deadlineAt: null,
    resolvedAt: null,
    captures: [],
    guess: null,
    result: null,
    promptVersion: 0
  }));
  if (!input.deferRoundStart) rounds[0] = openRound(rounds[0], input.now, input.roundDurationMs);

  return {
    gameId: input.gameId,
    createRequestId: input.createRequestId,
    guestIdHash: input.guestIdHash,
    guestExpiresAt: input.now + rankedGuestRetentionMs,
    accountId: null,
    status: "active",
    integrityStatus: "verified",
    integrityReasons: [],
    rulesetId: rankedRulesetId,
    rulesetVersion: rankedRulesetVersion,
    scoringVersion: rankedScoringVersion,
    category,
    roundDurationMs: input.roundDurationMs,
    timeLimitSec,
    difficulty,
    noZoom,
    startedAt: input.now,
    completedAt: null,
    score: 0,
    totalResponseTimeMs: 0,
    rounds
  };
}

export function activateRankedRound(game: RankedGame, roundId: string, now: number): RankedGame {
  if (game.status === "completed") throw new RankedGameError("game_completed", "The game is already completed.");
  const roundIndex = game.rounds.findIndex((round) => round.roundId === roundId);
  if (roundIndex < 0) throw new RankedGameError("round_mismatch", "The round does not belong to this game.");
  const round = game.rounds[roundIndex];
  if (round.status === "open") return game;
  if (round.status !== "pending" || game.rounds.some((candidate) => candidate.status === "open")) {
    throw new RankedGameError("round_not_open", "The round is no longer waiting to start.");
  }
  const rounds = [...game.rounds];
  rounds[roundIndex] = openRound(round, now, game.roundDurationMs);
  return { ...game, rounds };
}

export function replaceRankedRoundLocation(game: RankedGame, roundId: string, location: GeoLocation): RankedGame {
  if (game.status === "completed") throw new RankedGameError("game_completed", "The game is already completed.");
  const roundIndex = game.rounds.findIndex((round) => round.roundId === roundId);
  if (roundIndex < 0) throw new RankedGameError("round_mismatch", "The round does not belong to this game.");
  const round = game.rounds[roundIndex];
  if (round.status !== "pending" || game.rounds.some((candidate) => candidate.status === "open")) {
    throw new RankedGameError("round_not_open", "The round is no longer waiting for a new location.");
  }
  const rounds = [...game.rounds];
  rounds[roundIndex] = {
    ...round,
    location,
    startedAt: null,
    deadlineAt: null,
    resolvedAt: null,
    captures: [],
    guess: null,
    result: null,
    promptVersion: (round.promptVersion ?? 0) + 1
  };
  return { ...game, rounds };
}

function validCoordinates(point: LatLng): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && point.lat >= -85 && point.lat <= 85 && point.lng >= -180 && point.lng <= 180;
}

function activeRoundIndex(game: RankedGame): number {
  return game.rounds.findIndex((round) => round.status === "open");
}

function withIntegrityReason(game: RankedGame, reason: string): Pick<RankedGame, "integrityStatus" | "integrityReasons"> {
  return {
    integrityStatus: game.integrityStatus === "invalid" ? "invalid" : "flagged",
    integrityReasons: game.integrityReasons.includes(reason) ? game.integrityReasons : [...game.integrityReasons, reason]
  };
}

function advanceAfterResolution(game: RankedGame, roundIndex: number, resolvedRound: RankedRound, now: number): RankedGame {
  const rounds = [...game.rounds];
  rounds[roundIndex] = resolvedRound;
  const nextRound = rounds[roundIndex + 1];
  const completed = !nextRound;
  return {
    ...game,
    rounds,
    status: completed ? "completed" : "active",
    completedAt: completed ? now : null,
    // A guest must always receive the full claim window after the end screen,
    // even when the game itself was started much earlier.
    guestExpiresAt: completed && game.accountId === null ? now + rankedGuestRetentionMs : game.guestExpiresAt
  };
}

export type CaptureRankedGuessInput = {
  guessId: string;
  roundId: string;
  point: LatLng;
  countryCode?: string;
  now: number;
};

export function captureRankedGuess(game: RankedGame, input: CaptureRankedGuessInput): RankedGame {
  if (game.status === "completed") throw new RankedGameError("game_completed", "The game is already completed.");
  if (!input.guessId || !validCoordinates(input.point) || !Number.isFinite(input.now)) {
    throw new RankedGameError("invalid_guess", "Guess coordinates or identifiers are invalid.");
  }
  const roundIndex = activeRoundIndex(game);
  if (roundIndex < 0) throw new RankedGameError("round_not_open", "No round is currently open.");
  const round = game.rounds[roundIndex];
  if (round.roundId !== input.roundId) throw new RankedGameError("round_mismatch", "The guess does not belong to the open round.");
  if (round.startedAt === null || round.deadlineAt === null) throw new RankedGameError("round_not_open", "Round timing is missing.");
  if (input.now > round.deadlineAt) throw new RankedGameError("round_expired", "The round deadline has passed.");
  const existingCapture = round.captures?.find((capture) => capture.guessId === input.guessId);
  if (existingCapture) {
    const samePayload = existingCapture.lat === input.point.lat
      && existingCapture.lng === input.point.lng
      && existingCapture.countryCode === input.countryCode;
    if (!samePayload) throw new RankedGameError("capture_conflict", "The capture identifier was already used with different data.");
    return game;
  }
  const rounds = [...game.rounds];
  rounds[roundIndex] = {
    ...round,
    captures: [...(round.captures ?? []), {
      guessId: input.guessId,
      roundId: input.roundId,
      lat: input.point.lat,
      lng: input.point.lng,
      countryCode: input.countryCode,
      capturedAt: input.now
    }].slice(-32)
  };
  return { ...game, rounds };
}

export type SubmitRankedGuessInput = {
  guessId: string;
  roundId: string;
  now: number;
};

function resolveCapturedGuess(game: RankedGame, roundIndex: number, capture: RankedGuessCapture, resolvedAt: number): RankedGame {
  const round = game.rounds[roundIndex];
  if (round.startedAt === null) throw new RankedGameError("round_not_open", "Round timing is missing.");
  const responseTimeMs = Math.max(0, capture.capturedAt - round.startedAt);
  const guess: RankedGuess = {
    guessId: capture.guessId,
    roundId: capture.roundId,
    playerId: game.accountId ?? "guest",
    lat: capture.lat,
    lng: capture.lng,
    countryCode: capture.countryCode,
    createdAt: capture.capturedAt,
    responseTimeMs
  };
  const result = evaluatePlayerGuess(guess.playerId, round.location, guess);
  const resolvedRound: RankedRound = { ...round, status: "resolved", resolvedAt, captures: [], guess, result };
  const integrity = result.points === 5000 && responseTimeMs < 750 ? withIntegrityReason(game, "perfect_too_fast") : null;
  const advanced = advanceAfterResolution(game, roundIndex, resolvedRound, resolvedAt);
  return { ...advanced, ...(integrity ?? {}), score: game.score + result.points, totalResponseTimeMs: game.totalResponseTimeMs + responseTimeMs };
}

export function submitRankedGuess(game: RankedGame, input: SubmitRankedGuessInput): RankedGame {
  const existing = game.rounds.find((round) => round.guess?.guessId === input.guessId);
  if (existing) {
    const samePayload =
      existing.roundId === input.roundId &&
      existing.guess?.guessId === input.guessId;
    if (!samePayload) throw new RankedGameError("guess_conflict", "The guess identifier was already used with different data.");
    return game;
  }
  if (game.status === "completed") throw new RankedGameError("game_completed", "The game is already completed.");
  if (!input.guessId || !Number.isFinite(input.now)) throw new RankedGameError("invalid_guess", "Guess identifiers are invalid.");

  const roundIndex = activeRoundIndex(game);
  if (roundIndex < 0) throw new RankedGameError("round_not_open", "No round is currently open.");
  const round = game.rounds[roundIndex];
  if (round.roundId !== input.roundId) throw new RankedGameError("round_mismatch", "The guess does not belong to the open round.");
  const capture = round.captures?.find((candidate) => candidate.guessId === input.guessId);
  if (!capture) {
    throw new RankedGameError("capture_required", "The guess was not captured by the server before the deadline.");
  }
  return resolveCapturedGuess(game, roundIndex, capture, input.now);
}

export function expireOpenRound(game: RankedGame, now: number): RankedGame {
  if (game.status === "completed") return game;
  const roundIndex = activeRoundIndex(game);
  if (roundIndex < 0) throw new RankedGameError("round_not_open", "No round is currently open.");
  const round = game.rounds[roundIndex];
  if (round.deadlineAt === null || now <= round.deadlineAt) {
    throw new RankedGameError("round_not_open", "The open round has not expired.");
  }
  const latestCapture = round.captures?.reduce<RankedGuessCapture | null>(
    (latest, capture) => !latest || capture.capturedAt >= latest.capturedAt ? capture : latest,
    null
  );
  if (latestCapture) return resolveCapturedGuess(game, roundIndex, latestCapture, now);
  const result = evaluatePlayerGuess(game.accountId ?? "guest", round.location, null);
  const advanced = advanceAfterResolution(game, roundIndex, {
    ...round,
    status: "resolved",
    resolvedAt: now,
    result
  }, now);
  return {
    ...advanced,
    totalResponseTimeMs: game.totalResponseTimeMs + game.roundDurationMs
  };
}

export function claimRankedGame(game: RankedGame, accountId: string): RankedGame {
  if (game.status !== "completed") throw new RankedGameError("game_not_completed", "Only completed games can be claimed.");
  if (!accountId.trim()) throw new RankedGameError("claim_conflict", "A permanent account identifier is required.");
  if (game.accountId === accountId) return game;
  if (game.accountId) throw new RankedGameError("claim_conflict", "The game is already claimed by another account.");
  return { ...game, accountId, guestIdHash: null, guestExpiresAt: null };
}

export function isExpiredUnclaimedRankedGame(game: RankedGame, now: number): boolean {
  return game.accountId === null && game.guestExpiresAt !== null && Number.isFinite(now) && game.guestExpiresAt <= now;
}

export function invalidateRankedGame(game: RankedGame, reason: string): RankedGame {
  if (!reason.trim()) throw new RankedGameError("invalid_game", "An invalidation reason is required.");
  return {
    ...game,
    integrityStatus: "invalid",
    integrityReasons: game.integrityReasons.includes(reason) ? game.integrityReasons : [...game.integrityReasons, reason]
  };
}

export function toPublicRankedGame(game: RankedGame): PublicRankedGame {
  const activeRound = game.rounds.find((round) => round.status === "open")
    ?? game.rounds.find((round) => round.status === "pending")
    ?? null;
  const resolvedRounds = game.rounds.flatMap((round): PublicResolvedRankedRound[] => {
    if (round.status !== "resolved" || !round.result || round.resolvedAt === null) return [];
    return [{
      roundId: round.roundId,
      roundNumber: round.roundNumber,
      location: {
        title: round.location.title,
        countryCode: round.location.countryCode,
        countryName: round.location.countryName,
        continent: round.location.continent,
        lat: round.location.lat,
        lng: round.location.lng,
        category: round.location.category,
        imageFile: round.location.imageFile,
        shortDescription: round.location.shortDescription,
        descriptionSourceUrl: round.location.descriptionSourceUrl
      },
      result: round.result,
      resolvedAt: round.resolvedAt
    }];
  });

  return {
    gameId: game.gameId,
    status: game.status,
    integrityStatus: game.integrityStatus,
    rulesetId: game.rulesetId,
    rulesetVersion: game.rulesetVersion,
    scoringVersion: game.scoringVersion,
    category: game.category,
    score: game.score,
    totalResponseTimeMs: game.totalResponseTimeMs,
    activeRound: activeRound ? {
      roundId: activeRound.roundId,
      roundNumber: activeRound.roundNumber,
      totalRounds: game.rounds.length,
      category: activeRound.location.category,
      assetUrl: `/api/v1/ranked-games/${encodeURIComponent(game.gameId)}/rounds/${encodeURIComponent(activeRound.roundId)}/prompt?v=${activeRound.promptVersion ?? 0}`,
      startedAt: activeRound.startedAt,
      deadlineAt: activeRound.deadlineAt
    } : null,
    resolvedRounds,
    completedAt: game.completedAt,
    claimed: Boolean(game.accountId),
    timeLimitSec: game.timeLimitSec,
    difficulty: game.difficulty,
    noZoom: game.noZoom
  };
}
