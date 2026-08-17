import assert from "node:assert/strict";
import test from "node:test";
import { RankedModerationError, type RankedModerationRepository } from "../../lib/rankedModeration";
import type { RankedGameRepository } from "../../lib/rankedGameRepository";
import { createRankedGame } from "../../lib/rankedGame";
import type { GeoLocation } from "../../types/game";

export type RankedModerationFactory = () => Promise<{
  games: RankedGameRepository;
  moderation: RankedModerationRepository;
}> | { games: RankedGameRepository; moderation: RankedModerationRepository };

function game() {
  const location: GeoLocation = {
    id: "location-0001", title: "Secret", countryCode: "DE", countryName: "Deutschland",
    continent: "Europe", lat: 48, lng: 9, panoramaUrl: "https://example.test/image.jpg",
    attribution: "Test", source: "ugc", category: "cities"
  };
  return createRankedGame({
    gameId: "game-0001", createRequestId: "request-0001", guestIdHash: "guest-hash",
    locations: [location], roundIds: ["round-0001"], now: 1_000, roundDurationMs: 60_000
  });
}

const command = {
  eventId: "event-0001",
  gameId: "game-0001",
  reasonCode: "impossible_speed",
  actorId: "moderator-0001",
  now: 2_000
};

export function rankedModerationContract(label: string, factory: RankedModerationFactory): void {
  test(`${label}: invalidation stores immutable audit and changes game atomically`, async () => {
    const { games, moderation } = await factory();
    await games.create(game());
    const result = await moderation.invalidateAtomically(command);
    assert.equal(result.game.integrityStatus, "invalid");
    assert.equal((await games.findById(command.gameId))?.integrityStatus, "invalid");
    assert.equal(result.event.previousIntegrityStatus, "verified");
    assert.equal(result.event.projectionStatus, "pending");
    assert.deepEqual(await moderation.findEvent(command.eventId), result.event);
  });

  test(`${label}: event retry is idempotent and conflicting reuse is rejected`, async () => {
    const { games, moderation } = await factory();
    await games.create(game());
    const first = await moderation.invalidateAtomically(command);
    assert.deepEqual(await moderation.invalidateAtomically(command), first);
    await assert.rejects(
      moderation.invalidateAtomically({ ...command, reasonCode: "different_reason" }),
      (error: unknown) => error instanceof RankedModerationError && error.code === "event_conflict"
    );
  });

  test(`${label}: ranking projection completion is idempotent and auditable`, async () => {
    const { games, moderation } = await factory();
    await games.create(game());
    await moderation.invalidateAtomically(command);
    const completed = await moderation.markProjectionCompleted(command.eventId, 3_000);
    assert.equal(completed.projectionStatus, "completed");
    assert.equal(completed.projectionCompletedAt, 3_000);
    assert.deepEqual(await moderation.markProjectionCompleted(command.eventId, 4_000), completed);
  });
}
