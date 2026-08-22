import assert from "node:assert/strict";
import test from "node:test";
import { createRankedGame, claimRankedGame, expireOpenRound, invalidateRankedGame, isExpiredUnclaimedRankedGame, rankedGuestRetentionMs, RankedGameError, submitRankedGuess, toPublicRankedGame } from "../lib/rankedGame";
import { InMemoryRankedGameRepository } from "../lib/rankedGameRepository";
import type { GeoLocation } from "../types/game";

function location(id: string, lat: number, lng: number): GeoLocation {
  return {
    id,
    title: `Secret ${id}`,
    countryCode: "DE",
    countryName: "Deutschland",
    continent: "Europe",
    lat,
    lng,
    panoramaUrl: `https://example.test/${id}.jpg`,
    attribution: "Test",
    source: "ugc",
    category: "landmarks",
    shortDescription: `Kurzinfo ${id}`
  };
}

function game(rounds = 2) {
  const locations = Array.from({ length: rounds }, (_, index) => location(`loc-${index + 1}`, 48 + index, 9 + index));
  return createRankedGame({
    gameId: "game-1",
    createRequestId: "request-1",
    guestIdHash: "guest-hash",
    locations,
    roundIds: locations.map((_, index) => `round-${index + 1}`),
    now: 1_000,
    roundDurationMs: 60_000
  });
}

function expectCode(expected: RankedGameError["code"], action: () => unknown): void {
  assert.throws(action, (error: unknown) => error instanceof RankedGameError && error.code === expected);
}

test("public state hides the active answer and uses an opaque prompt endpoint", () => {
  const internal = game();
  const publicState = toPublicRankedGame(internal);
  assert.deepEqual(publicState.resolvedRounds, []);
  assert.equal(publicState.activeRound?.roundId, "round-1");
  assert.equal(publicState.activeRound?.assetUrl, "/api/v1/ranked-games/game-1/rounds/round-1/prompt?v=0");
  const serialized = JSON.stringify(publicState);
  assert.equal(serialized.includes("Secret loc-1"), false);
  assert.equal(serialized.includes("48"), false);
  assert.equal(serialized.includes("loc-1"), false);
  assert.equal(serialized.includes("Kurzinfo"), false);
});

test("server scoring resolves a guess and leaves the next round waiting for its image", () => {
  const updated = submitRankedGuess(game(), {
    guessId: "guess-1",
    roundId: "round-1",
    point: { lat: 48.1, lng: 9.1 },
    now: 11_000
  });
  assert.equal(updated.rounds[0].status, "resolved");
  assert.ok((updated.rounds[0].result?.points ?? 0) > 0);
  assert.equal(updated.rounds[1].status, "pending");
  assert.equal(updated.rounds[1].startedAt, null);
  assert.equal(updated.totalResponseTimeMs, 10_000);
  assert.equal(toPublicRankedGame(updated).resolvedRounds[0]?.location.shortDescription, "Kurzinfo loc-1");
});

test("repeating the same guess request is idempotent", () => {
  const once = submitRankedGuess(game(), {
    guessId: "guess-1",
    roundId: "round-1",
    point: { lat: 47, lng: 8 },
    now: 5_000
  });
  const twice = submitRankedGuess(once, {
    guessId: "guess-1",
    roundId: "round-1",
    point: { lat: 47, lng: 8 },
    now: 5_000
  });
  assert.equal(twice, once);
  assert.equal(twice.score, once.score);
});

test("reusing a guess identifier with different data is rejected", () => {
  const once = submitRankedGuess(game(), {
    guessId: "guess-1",
    roundId: "round-1",
    point: { lat: 47, lng: 8 },
    now: 5_000
  });
  expectCode("guess_conflict", () => submitRankedGuess(once, {
    guessId: "guess-1",
    roundId: "round-1",
    point: { lat: 46, lng: 8 },
    now: 5_000
  }));
});

test("invalid coordinates, wrong rounds and late guesses are rejected", () => {
  expectCode("invalid_guess", () => submitRankedGuess(game(), {
    guessId: "bad",
    roundId: "round-1",
    point: { lat: 91, lng: 9 },
    now: 2_000
  }));
  expectCode("round_mismatch", () => submitRankedGuess(game(), {
    guessId: "wrong-round",
    roundId: "round-2",
    point: { lat: 48, lng: 9 },
    now: 2_000
  }));
  expectCode("round_expired", () => submitRankedGuess(game(), {
    guessId: "late",
    roundId: "round-1",
    point: { lat: 48, lng: 9 },
    now: 61_001
  }));
});

test("expired rounds score zero and leave the next round waiting for its image", () => {
  const expired = expireOpenRound(game(), 61_001);
  assert.equal(expired.rounds[0].result?.points, 0);
  assert.equal(expired.rounds[1].status, "pending");
  assert.equal(expired.score, 0);
  assert.equal(expired.totalResponseTimeMs, 60_000);
});

test("a completed guest game can be claimed exactly once", () => {
  let current = game(1);
  current = submitRankedGuess(current, {
    guessId: "guess-1",
    roundId: "round-1",
    point: { lat: 47, lng: 8 },
    now: 5_000
  });
  assert.equal(current.status, "completed");
  const claimed = claimRankedGame(current, "account-1");
  assert.equal(claimed.accountId, "account-1");
  assert.equal(claimed.guestIdHash, null);
  assert.equal(claimed.guestExpiresAt, null);
  assert.equal(claimRankedGame(claimed, "account-1"), claimed);
  expectCode("claim_conflict", () => claimRankedGame(claimed, "account-2"));
});

test("unclaimed guest retention expires after 72 hours but claimed games do not", () => {
  const current = game(1);
  assert.equal(current.guestExpiresAt, current.startedAt + rankedGuestRetentionMs);
  assert.equal(isExpiredUnclaimedRankedGame(current, current.guestExpiresAt as number), true);
  const completed = submitRankedGuess(current, {
    guessId: "guess-retention",
    roundId: "round-1",
    point: { lat: 47, lng: 8 },
    now: 2_000
  });
  assert.equal(completed.guestExpiresAt, 2_000 + rankedGuestRetentionMs);
  assert.equal(isExpiredUnclaimedRankedGame(claimRankedGame(completed, "account-1"), Number.MAX_SAFE_INTEGER), false);
});

test("suspicious perfect speed is flagged and moderation can invalidate it", () => {
  const perfect = submitRankedGuess(game(1), {
    guessId: "perfect",
    roundId: "round-1",
    point: { lat: 48, lng: 9 },
    now: 1_500
  });
  assert.equal(perfect.integrityStatus, "flagged");
  assert.deepEqual(perfect.integrityReasons, ["perfect_too_fast"]);
  const invalid = invalidateRankedGame(perfect, "manual_review");
  assert.equal(invalid.integrityStatus, "invalid");
  assert.deepEqual(invalid.integrityReasons, ["perfect_too_fast", "manual_review"]);
});

test("repository makes create requests and atomic retries idempotent", async () => {
  const repository = new InMemoryRankedGameRepository();
  const initial = game(1);
  assert.deepEqual(await repository.create(initial), initial);
  assert.deepEqual(await repository.create({ ...initial, gameId: "other-game" }), initial);
  const updated = await repository.updateAtomically(initial.gameId, (current) => submitRankedGuess(current, {
    guessId: "guess-1",
    roundId: "round-1",
    point: { lat: 47, lng: 8 },
    now: 5_000
  }));
  const retried = await repository.updateAtomically(initial.gameId, (current) => submitRankedGuess(current, {
    guessId: "guess-1",
    roundId: "round-1",
    point: { lat: 47, lng: 8 },
    now: 5_000
  }));
  assert.equal(retried.score, updated.score);
});
