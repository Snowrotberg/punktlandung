import { invalidateRankedGame, type RankedGame, type RankedIntegrityStatus } from "./rankedGame";
import type { RankedGameRepository } from "./rankedGameRepository";

export type RankedModerationEvent = {
  eventId: string;
  gameId: string;
  action: "invalidate_score";
  reasonCode: string;
  actorId: string;
  previousIntegrityStatus: RankedIntegrityStatus;
  resultingIntegrityStatus: "invalid";
  createdAt: number;
  projectionStatus: "pending" | "completed";
  projectionCompletedAt: number | null;
};

export class RankedModerationError extends Error {
  constructor(readonly code: "invalid_request" | "event_conflict", message: string) {
    super(message);
    this.name = "RankedModerationError";
  }
}

export interface RankedModerationRepository {
  invalidateAtomically(input: {
    eventId: string;
    gameId: string;
    reasonCode: string;
    actorId: string;
    now: number;
  }): Promise<{ game: RankedGame; event: RankedModerationEvent }>;
  findEvent(eventId: string): Promise<RankedModerationEvent | null>;
  markProjectionCompleted(eventId: string, now: number): Promise<RankedModerationEvent>;
}

/** In-memory reference; provider adapters must perform game + event in one transaction. */
export class InMemoryRankedModerationRepository implements RankedModerationRepository {
  private readonly events = new Map<string, RankedModerationEvent>();

  constructor(private readonly games: RankedGameRepository) {}

  async invalidateAtomically(input: {
    eventId: string;
    gameId: string;
    reasonCode: string;
    actorId: string;
    now: number;
  }): Promise<{ game: RankedGame; event: RankedModerationEvent }> {
    this.validateInput(input);
    const existing = this.events.get(input.eventId);
    if (existing) {
      if (existing.gameId !== input.gameId || existing.reasonCode !== input.reasonCode || existing.actorId !== input.actorId) {
        throw new RankedModerationError("event_conflict", "Moderation event ID was already used.");
      }
      const game = await this.games.findById(existing.gameId);
      if (!game) throw new RankedModerationError("event_conflict", "Moderated game no longer exists.");
      return { game, event: structuredClone(existing) };
    }
    let previousStatus: RankedIntegrityStatus = "verified";
    const game = await this.games.updateAtomically(input.gameId, (current) => {
      previousStatus = current.integrityStatus;
      return invalidateRankedGame(current, input.reasonCode);
    });
    const event: RankedModerationEvent = {
      eventId: input.eventId,
      gameId: input.gameId,
      action: "invalidate_score",
      reasonCode: input.reasonCode,
      actorId: input.actorId,
      previousIntegrityStatus: previousStatus,
      resultingIntegrityStatus: "invalid",
      createdAt: input.now,
      projectionStatus: "pending",
      projectionCompletedAt: null
    };
    this.events.set(event.eventId, structuredClone(event));
    return { game, event: structuredClone(event) };
  }

  async findEvent(eventId: string): Promise<RankedModerationEvent | null> {
    const event = this.events.get(eventId);
    return event ? structuredClone(event) : null;
  }

  async markProjectionCompleted(eventId: string, now: number): Promise<RankedModerationEvent> {
    const current = this.events.get(eventId);
    if (!current || !Number.isSafeInteger(now) || now < current.createdAt) {
      throw new RankedModerationError("invalid_request", "Moderation projection completion is invalid.");
    }
    if (current.projectionStatus === "completed") return structuredClone(current);
    const completed: RankedModerationEvent = {
      ...current,
      projectionStatus: "completed",
      projectionCompletedAt: now
    };
    this.events.set(eventId, completed);
    return structuredClone(completed);
  }

  private validateInput(input: { eventId: string; gameId: string; reasonCode: string; actorId: string; now: number }): void {
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(input.eventId)
      || !/^[A-Za-z0-9_-]{8,128}$/.test(input.gameId)
      || !/^[a-z0-9_]{3,64}$/.test(input.reasonCode)
      || !/^[A-Za-z0-9_-]{3,128}$/.test(input.actorId)
      || !Number.isSafeInteger(input.now)) {
      throw new RankedModerationError("invalid_request", "Moderation request is invalid.");
    }
  }
}
