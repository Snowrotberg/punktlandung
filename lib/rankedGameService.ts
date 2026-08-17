import { timingSafeEqual } from "node:crypto";
import {
  claimRankedGame,
  activateRankedRound,
  createRankedGame,
  expireOpenRound,
  replaceRankedRoundLocation,
  RankedGameError,
  submitRankedGuess,
  toPublicRankedGame,
  type PublicRankedGame,
  type SubmitRankedGuessInput
} from "./rankedGame";
import type { RankedGameRepository } from "./rankedGameRepository";
import type { GeoLocation } from "../types/game";

export interface RankedLocationSource {
  drawLocations(count: number, filters?: { category?: GeoLocation["category"]; difficulty?: "easy" | "medium" | "hard" }): Promise<GeoLocation[]>;
}

export interface RankedIdSource {
  gameId(): string;
  roundId(roundNumber: number): string;
}

export type StartRankedGameCommand = {
  createRequestId: string;
  guestIdHash: string;
  now: number;
  rounds?: number;
  timeLimitSec?: 0 | 15 | 30 | 60;
  category?: GeoLocation["category"];
  difficulty?: "easy" | "medium" | "hard";
  noZoom?: boolean;
  deferRoundStart?: boolean;
};

export type RankedGameServiceOptions = {
  roundCount?: number;
  roundDurationMs?: number;
};

export type RankedPromptSource = {
  sourceUrl: string;
  fallbackUrls?: string[];
  category: GeoLocation["category"];
};

function safeStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Application service used by future Next.js routes or the WebSocket server.
 * It depends only on ports that can be backed by Firebase, Supabase or tests.
 */
export class RankedGameService {
  private readonly roundCount: number;
  private readonly roundDurationMs: number;

  constructor(
    private readonly repository: RankedGameRepository,
    private readonly locations: RankedLocationSource,
    private readonly ids: RankedIdSource,
    options: RankedGameServiceOptions = {}
  ) {
    this.roundCount = options.roundCount ?? 15;
    this.roundDurationMs = options.roundDurationMs ?? 60_000;
    if (!Number.isInteger(this.roundCount) || this.roundCount < 1 || this.roundCount > 25) {
      throw new Error("Ranked round count must be between 1 and 25.");
    }
  }

  async start(command: StartRankedGameCommand): Promise<PublicRankedGame> {
    if (!command.createRequestId.trim() || !command.guestIdHash.trim()) {
      throw new RankedGameError("invalid_game", "Request and guest identifiers are required.");
    }
    const existing = await this.repository.findByCreateRequest(command.createRequestId);
    if (existing) {
      this.assertGuest(existing.guestIdHash, command.guestIdHash);
      return toPublicRankedGame(existing);
    }

    const rounds = command.rounds ?? this.roundCount;
    const timeLimitSec = command.timeLimitSec ?? 60;
    const category = command.category ?? "mixed";
    const difficulty = command.difficulty ?? "medium";
    const noZoom = command.noZoom ?? false;
    const durationMs = timeLimitSec === 0 ? 10 * 60_000 : timeLimitSec * 1000;
    const selectedLocations = await this.locations.drawLocations(rounds, { category, difficulty });
    if (selectedLocations.length !== rounds || new Set(selectedLocations.map((location) => location.id)).size !== rounds) {
      throw new RankedGameError("invalid_game", "Location source did not return the required unique ranked locations.");
    }
    const game = createRankedGame({
      gameId: this.ids.gameId(),
      createRequestId: command.createRequestId,
      guestIdHash: command.guestIdHash,
      locations: selectedLocations,
      roundIds: selectedLocations.map((_, index) => this.ids.roundId(index + 1)),
      now: command.now,
      roundDurationMs: durationMs,
      timeLimitSec,
      difficulty,
      noZoom,
      deferRoundStart: command.deferRoundStart
    });
    const created = await this.repository.create(game);
    this.assertGuest(created.guestIdHash, command.guestIdHash);
    return toPublicRankedGame(created);
  }

  async get(gameId: string, guestIdHash: string, accountId?: string): Promise<PublicRankedGame> {
    const game = await this.requireGame(gameId);
    this.assertAccess(game, guestIdHash, accountId);
    return toPublicRankedGame(game);
  }

  async recoverLatest(guestIdHash: string): Promise<PublicRankedGame | null> {
    const game = await this.repository.findLatestActiveByGuestIdHash(guestIdHash);
    return game ? toPublicRankedGame(game) : null;
  }

  async resumeLocalGame(gameId: string, guestIdHash: string, now: number): Promise<PublicRankedGame> {
    const updated = await this.repository.updateAtomically(gameId, (current) => {
      if (current.status !== "active" || current.accountId !== null) {
        throw new RankedGameError("invalid_game", "Only an active guest game can be resumed locally.");
      }
      return {
        ...current,
        guestIdHash,
        guestExpiresAt: Math.max(current.guestExpiresAt ?? 0, now + 72 * 60 * 60 * 1000)
      };
    });
    return toPublicRankedGame(updated);
  }

  async submit(gameId: string, guestIdHash: string, command: SubmitRankedGuessInput, accountId?: string): Promise<PublicRankedGame> {
    const updated = await this.repository.updateAtomically(gameId, (current) => {
      this.assertAccess(current, guestIdHash, accountId);
      const next = submitRankedGuess(current, command);
      return accountId && next.status === "completed" ? claimRankedGame(next, accountId) : next;
    });
    return toPublicRankedGame(updated);
  }

  async promptSource(gameId: string, guestIdHash: string, roundId: string, accountId?: string): Promise<RankedPromptSource> {
    const game = await this.requireGame(gameId);
    this.assertAccess(game, guestIdHash, accountId);
    const currentPromptRound = game.rounds.find((candidate) => candidate.status === "open")
      ?? game.rounds.find((candidate) => candidate.status === "pending")
      ?? null;
    // The opaque prompt URL is also the exact asset the player has already
    // seen. Keep it available for this authenticated game after resolution so
    // "Bild nochmal ansehen" can reuse the private browser cache immediately.
    // Other rounds and foreign games remain inaccessible through assertAccess.
    const resolvedRound = game.rounds.find((candidate) => candidate.roundId === roundId && candidate.status === "resolved") ?? null;
    const round = currentPromptRound?.roundId === roundId ? currentPromptRound : resolvedRound;
    if (!round) throw new RankedGameError("invalid_game", "Ranked game does not exist.");
    const urls = [round.location.panoramaUrl, ...(round.location.panoramaUrls ?? [])].filter((url, index, all) => Boolean(url) && all.indexOf(url) === index);
    return { sourceUrl: urls[0] ?? round.location.panoramaUrl, fallbackUrls: urls.slice(1), category: round.location.category };
  }

  async ready(gameId: string, guestIdHash: string, roundId: string, now: number, accountId?: string): Promise<PublicRankedGame> {
    const updated = await this.repository.updateAtomically(gameId, (current) => {
      this.assertAccess(current, guestIdHash, accountId);
      return activateRankedRound(current, roundId, now);
    });
    return toPublicRankedGame(updated);
  }

  async reroll(gameId: string, guestIdHash: string, roundId: string, accountId?: string): Promise<PublicRankedGame> {
    const current = await this.requireGame(gameId);
    this.assertAccess(current, guestIdHash, accountId);
    const round = current.rounds.find((candidate) => candidate.roundId === roundId);
    if (!round) throw new RankedGameError("round_mismatch", "The round does not belong to this game.");
    // Drawing one more distinct candidate than the game already contains
    // guarantees an unused replacement whenever the filtered pool has one.
    const candidates = await this.locations.drawLocations(current.rounds.length + 1, { category: round.location.category, difficulty: current.difficulty });
    const replacement = candidates.find((candidate) => !current.rounds.some((item) => item.location.id === candidate.id));
    if (!replacement) throw new RankedGameError("invalid_game", "No replacement location is currently available.");
    const updated = await this.repository.updateAtomically(gameId, (latest) => {
      this.assertAccess(latest, guestIdHash, accountId);
      return replaceRankedRoundLocation(latest, roundId, replacement);
    });
    return toPublicRankedGame(updated);
  }

  async expire(gameId: string, guestIdHash: string, now: number, accountId?: string): Promise<PublicRankedGame> {
    const updated = await this.repository.updateAtomically(gameId, (current) => {
      this.assertAccess(current, guestIdHash, accountId);
      const next = expireOpenRound(current, now);
      return accountId && next.status === "completed" ? claimRankedGame(next, accountId) : next;
    });
    return toPublicRankedGame(updated);
  }

  async claim(gameId: string, guestIdHash: string, accountId: string): Promise<PublicRankedGame> {
    const updated = await this.repository.updateAtomically(gameId, (current) => {
      if (current.accountId) return claimRankedGame(current, accountId);
      this.assertGuest(current.guestIdHash, guestIdHash);
      return claimRankedGame(current, accountId);
    });
    return toPublicRankedGame(updated);
  }

  private async requireGame(gameId: string) {
    const game = await this.repository.findById(gameId);
    if (!game) throw new RankedGameError("invalid_game", "Ranked game does not exist.");
    return game;
  }

  private assertGuest(expected: string | null, supplied: string): void {
    if (!expected || !safeStringEqual(expected, supplied)) {
      throw new RankedGameError("invalid_game", "Ranked game does not exist.");
    }
  }

  private assertAccess(game: { guestIdHash: string | null; accountId: string | null }, guestIdHash: string, accountId?: string): void {
    if (game.accountId && accountId && safeStringEqual(game.accountId, accountId)) return;
    this.assertGuest(game.guestIdHash, guestIdHash);
  }
}
