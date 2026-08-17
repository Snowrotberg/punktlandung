import assert from "node:assert/strict";
import test from "node:test";
import { createRankedGame, type RankedGame } from "../../lib/rankedGame";
import type { RankedGameRepository } from "../../lib/rankedGameRepository";
import type { GeoLocation } from "../../types/game";

export type RankedGameRepositoryFactory = () => Promise<RankedGameRepository> | RankedGameRepository;

function game(overrides: Partial<RankedGame> = {}): RankedGame {
  const location: GeoLocation = {
    id: "location-0001",
    title: "Secret",
    countryCode: "DE",
    countryName: "Deutschland",
    continent: "Europe",
    lat: 48,
    lng: 9,
    panoramaUrl: "https://example.test/secret.jpg",
    attribution: "Test",
    source: "ugc",
    category: "cities"
  };
  return { ...createRankedGame({
    gameId: "game-0001",
    createRequestId: "request-0001",
    guestIdHash: "guest-hash-0001",
    locations: [location],
    roundIds: ["round-0001"],
    now: 1_000,
    roundDurationMs: 60_000
  }), ...overrides };
}

/** Register this suite unchanged for every Firebase or Supabase adapter. */
export function rankedGameRepositoryContract(label: string, factory: RankedGameRepositoryFactory): void {
  test(`${label}: create is idempotent by request and both lookup paths agree`, async () => {
    const repository = await factory();
    const created = await repository.create(game());
    const retry = await repository.create(game({ gameId: "game-0002" }));
    assert.equal(retry.gameId, created.gameId);
    assert.equal((await repository.findById(created.gameId))?.gameId, created.gameId);
    assert.equal((await repository.findByCreateRequest(created.createRequestId))?.gameId, created.gameId);
  });

  test(`${label}: reads and writes cannot mutate persisted state by reference`, async () => {
    const repository = await factory();
    const input = game();
    await repository.create(input);
    input.score = 999;
    const firstRead = await repository.findById("game-0001");
    assert.equal(firstRead?.score, 0);
    if (!firstRead) throw new Error("missing game");
    firstRead.score = 888;
    assert.equal((await repository.findById("game-0001"))?.score, 0);
  });

  test(`${label}: latest active game can be recovered for the same guest only`, async () => {
    const repository = await factory();
    await repository.create(game({ gameId: "game-0001", createRequestId: "request-0001", startedAt: 1_000 }));
    await repository.create(game({ gameId: "game-0002", createRequestId: "request-0002", startedAt: 2_000 }));
    await repository.create(game({
      gameId: "game-0003",
      createRequestId: "request-0003",
      guestIdHash: "other-guest",
      startedAt: 3_000
    }));
    const recovered = await repository.findLatestActiveByGuestIdHash("guest-hash-0001");
    assert.equal(recovered?.gameId, "game-0002");
    assert.equal(await repository.findLatestActiveByGuestIdHash("missing-guest"), null);
  });

  test(`${label}: atomic concurrent transforms preserve both updates`, async () => {
    const repository = await factory();
    await repository.create(game());
    await Promise.all([
      repository.updateAtomically("game-0001", (current) => ({ ...current, score: current.score + 1 })),
      repository.updateAtomically("game-0001", (current) => ({ ...current, score: current.score + 1 }))
    ]);
    assert.equal((await repository.findById("game-0001"))?.score, 2);
  });

  test(`${label}: atomic update cannot replace persistent identity`, async () => {
    const repository = await factory();
    await repository.create(game());
    await assert.rejects(repository.updateAtomically("game-0001", (current) => ({
      ...current,
      createRequestId: "request-hijacked"
    })));
  });

  test(`${label}: cleanup deletes only expired unclaimed games and respects its batch limit`, async () => {
    const repository = await factory();
    const expiredOne = game({ gameId: "game-0001", createRequestId: "request-0001", guestExpiresAt: 2_000 });
    const expiredTwo = game({ gameId: "game-0002", createRequestId: "request-0002", guestExpiresAt: 3_000 });
    const active = game({ gameId: "game-0003", createRequestId: "request-0003", guestExpiresAt: 10_000 });
    const claimed = game({
      gameId: "game-0004",
      createRequestId: "request-0004",
      guestIdHash: null,
      guestExpiresAt: null,
      accountId: "account-0001"
    });
    await repository.create(expiredOne);
    await repository.create(expiredTwo);
    await repository.create(active);
    await repository.create(claimed);
    assert.equal(await repository.deleteExpiredUnclaimed(5_000, 1), 1);
    assert.equal(await repository.findById("game-0001"), null);
    assert.ok(await repository.findById("game-0002"));
    assert.equal(await repository.deleteExpiredUnclaimed(5_000, 10), 1);
    assert.ok(await repository.findById("game-0003"));
    assert.ok(await repository.findById("game-0004"));
  });
}
