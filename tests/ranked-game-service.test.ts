import assert from "node:assert/strict";
import test from "node:test";
import { RankedGameError } from "../lib/rankedGame";
import { InMemoryRankedGameRepository } from "../lib/rankedGameRepository";
import { RankedGameService } from "../lib/rankedGameService";
import type { GeoLocation } from "../types/game";

function locations(count: number): GeoLocation[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `location-${index + 1}`,
    title: `Secret ${index + 1}`,
    countryCode: "DE",
    countryName: "Deutschland",
    continent: "Europe",
    lat: 48 + index,
    lng: 9 + index,
    panoramaUrl: `https://example.test/${index + 1}.jpg`,
    attribution: "Test",
    source: "ugc",
    category: "landmarks"
  }));
}

function service(roundCount = 1) {
  let nextGame = 0;
  return new RankedGameService(
    new InMemoryRankedGameRepository(),
    { drawLocations: async (count) => locations(count) },
    {
      gameId: () => `game-${++nextGame}`,
      roundId: (roundNumber) => `round-${roundNumber}`
    },
    { roundCount, roundDurationMs: 60_000 }
  );
}

function isCode(code: RankedGameError["code"]) {
  return (error: unknown) => error instanceof RankedGameError && error.code === code;
}

test("start retries return the same game without drawing another public answer", async () => {
  let draws = 0;
  const ranked = new RankedGameService(
    new InMemoryRankedGameRepository(),
    { drawLocations: async (count) => { draws += 1; return locations(count); } },
    { gameId: () => "game-1", roundId: (number) => `round-${number}` },
    { roundCount: 1 }
  );
  const first = await ranked.start({ createRequestId: "request-1", guestIdHash: "guest-a", now: 1_000 });
  const retry = await ranked.start({ createRequestId: "request-1", guestIdHash: "guest-a", now: 2_000 });
  assert.equal(retry.gameId, first.gameId);
  assert.equal(draws, 1);
});

test("a create request cannot be replayed by another guest", async () => {
  const ranked = service();
  await ranked.start({ createRequestId: "request-1", guestIdHash: "guest-a", now: 1_000 });
  await assert.rejects(
    ranked.start({ createRequestId: "request-1", guestIdHash: "guest-b", now: 1_000 }),
    isCode("invalid_game")
  );
});

test("latest active game can be recovered after the browser marker was lost", async () => {
  const ranked = service(2);
  const started = await ranked.start({ createRequestId: "request-recovery", guestIdHash: "guest-a", now: 1_000 });
  const recovered = await ranked.recoverLatest("guest-a");
  assert.equal(recovered?.gameId, started.gameId);
  assert.equal(recovered?.status, "active");
  assert.equal(await ranked.recoverLatest("guest-b"), null);
});

test("local rescue rebinds an active guest game without changing its progress", async () => {
  const ranked = service(2);
  const started = await ranked.start({ createRequestId: "request-rescue", guestIdHash: "guest-a", now: 1_000 });
  const rescued = await ranked.resumeLocalGame(started.gameId, "guest-b", 2_000);
  assert.equal(rescued.gameId, started.gameId);
  assert.equal(rescued.status, "active");
  assert.equal(rescued.score, started.score);
  assert.equal(rescued.resolvedRounds.length, started.resolvedRounds.length);
  assert.equal(await ranked.recoverLatest("guest-a"), null);
  assert.equal((await ranked.recoverLatest("guest-b"))?.gameId, started.gameId);
});

test("guest plays, completes and claims one game through the application service", async () => {
  const ranked = service();
  const started = await ranked.start({ createRequestId: "request-1", guestIdHash: "guest-a", now: 1_000 });
  const completed = await ranked.submit(started.gameId, "guest-a", {
    guessId: "guess-1",
    roundId: "round-1",
    point: { lat: 47, lng: 8 },
    now: 5_000
  });
  assert.equal(completed.status, "completed");
  assert.equal(completed.claimed, false);
  const claimed = await ranked.claim(completed.gameId, "guest-a", "account-1");
  assert.equal(claimed.claimed, true);
});

test("wrong guest cannot read, submit or claim another guest game", async () => {
  const ranked = service();
  const started = await ranked.start({ createRequestId: "request-1", guestIdHash: "guest-a", now: 1_000 });
  await assert.rejects(ranked.get(started.gameId, "guest-b"), isCode("invalid_game"));
  await assert.rejects(ranked.submit(started.gameId, "guest-b", {
    guessId: "guess-1",
    roundId: "round-1",
    point: { lat: 47, lng: 8 },
    now: 5_000
  }), isCode("invalid_game"));
});

test("only authorized prompt sources are available, including the player's resolved replay", async () => {
  const ranked = service(2);
  const started = await ranked.start({ createRequestId: "request-1", guestIdHash: "guest-a", now: 1_000 });
  const source = await ranked.promptSource(started.gameId, "guest-a", "round-1");
  assert.equal(source.sourceUrl, "https://example.test/1.jpg");
  await assert.rejects(ranked.promptSource(started.gameId, "guest-b", "round-1"), isCode("invalid_game"));
  await assert.rejects(ranked.promptSource(started.gameId, "guest-a", "round-2"), isCode("invalid_game"));

  await ranked.submit(started.gameId, "guest-a", {
    guessId: "guess-1",
    roundId: "round-1",
    point: { lat: 47, lng: 8 },
    now: 5_000
  });
  assert.equal((await ranked.promptSource(started.gameId, "guest-a", "round-1")).sourceUrl, "https://example.test/1.jpg");
  await assert.rejects(ranked.promptSource(started.gameId, "guest-b", "round-1"), isCode("invalid_game"));
});

test("each deferred round starts only after its own prompt is ready", async () => {
  const ranked = service(2);
  const created = await ranked.start({
    createRequestId: "request-deferred",
    guestIdHash: "guest-a",
    now: 1_000,
    deferRoundStart: true
  });

  assert.equal(created.activeRound?.roundId, "round-1");
  assert.equal(created.activeRound?.startedAt, null);
  assert.equal((await ranked.promptSource(created.gameId, "guest-a", "round-1")).sourceUrl, "https://example.test/1.jpg");

  const firstReady = await ranked.ready(created.gameId, "guest-a", "round-1", 2_000);
  assert.equal(firstReady.activeRound?.startedAt, 2_000);
  const afterFirst = await ranked.submit(created.gameId, "guest-a", {
    guessId: "guess-first",
    roundId: "round-1",
    point: { lat: 48, lng: 9 },
    now: 3_000
  });

  assert.equal(afterFirst.activeRound?.roundId, "round-2");
  assert.equal(afterFirst.activeRound?.startedAt, null);
  assert.equal((await ranked.promptSource(created.gameId, "guest-a", "round-2")).sourceUrl, "https://example.test/2.jpg");

  const secondReady = await ranked.ready(created.gameId, "guest-a", "round-2", 4_000);
  assert.equal(secondReady.activeRound?.startedAt, 4_000);
});

test("reroll searches beyond already assigned locations in a long game", async () => {
  const repository = new InMemoryRankedGameRepository();
  const pool = locations(16);
  const drawCounts: number[] = [];
  const ranked = new RankedGameService(
    repository,
    { drawLocations: async (count) => { drawCounts.push(count); return pool.slice(0, count); } },
    { gameId: () => "game-long", roundId: (number) => `round-${number}` },
    { roundCount: 15 }
  );
  const started = await ranked.start({ createRequestId: "request-long", guestIdHash: "guest-a", now: 1_000, deferRoundStart: true });

  const rerolled = await ranked.reroll(started.gameId, "guest-a", "round-1");

  assert.deepEqual(drawCounts, [15, 16]);
  assert.match(rerolled.activeRound?.assetUrl ?? "", /[?&]v=1(?:&|$)/);
  assert.equal((await ranked.promptSource(started.gameId, "guest-a", "round-1")).sourceUrl, "https://example.test/16.jpg");
});

test("location source must return the exact number of unique locations", async () => {
  const duplicate = locations(1)[0];
  const ranked = new RankedGameService(
    new InMemoryRankedGameRepository(),
    { drawLocations: async () => [duplicate, duplicate] },
    { gameId: () => "game-1", roundId: (number) => `round-${number}` },
    { roundCount: 2 }
  );
  await assert.rejects(
    ranked.start({ createRequestId: "request-1", guestIdHash: "guest-a", now: 1_000 }),
    isCode("invalid_game")
  );
});
