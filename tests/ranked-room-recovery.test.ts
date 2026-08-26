import assert from "node:assert/strict";
import test from "node:test";
import { rankedRoundPromptUrl, roomFromRankedGame, shouldRevealPendingRankedRound } from "../hooks/useRankedSoloGame";
import type { PublicRankedGame } from "../lib/rankedGame";
import type { GameSettings } from "../types/game";

const settings: GameSettings = {
  mode: "classic",
  localMode: "solo",
  localPlayerCount: 1,
  timeLimitSec: 60,
  rounds: 10,
  noMove: false,
  noPan: false,
  noZoom: false,
  mapPackId: "world",
  category: "mixed",
  difficulty: "medium"
};

function rankedGame(activeRoundStartedAt: number | null): PublicRankedGame {
  return {
    gameId: "ranked-test",
    status: "active",
    integrityStatus: "verified",
    rulesetId: "daily-five",
    rulesetVersion: 1,
    scoringVersion: "distance-v1",
    category: "mixed",
    score: 4_200,
    totalResponseTimeMs: 8_000,
    activeRound: {
      roundId: "round-2",
      roundNumber: 2,
      totalRounds: 10,
      category: "capitals",
      assetUrl: "/api/v1/ranked-games/ranked-test/rounds/round-2/prompt?v=1",
      startedAt: activeRoundStartedAt,
      deadlineAt: activeRoundStartedAt === null ? null : activeRoundStartedAt + 60_000
    },
    resolvedRounds: [{
      roundId: "round-1",
      roundNumber: 1,
      location: {
        title: "Berlin",
        countryCode: "DE",
        countryName: "Deutschland",
        continent: "Europa",
        lat: 52.52,
        lng: 13.405,
        category: "capitals"
      },
      result: {
        playerId: "ranked-player",
        distanceKm: 12,
        points: 4_200,
        badge: "Nah dran",
        eliminated: false,
        guess: {
          playerId: "ranked-player",
          lat: 52.4,
          lng: 13.3,
          createdAt: 9_000,
          responseTimeMs: 8_000
        },
        countryCorrect: true
      },
      resolvedAt: 10_000
    }],
    completedAt: null,
    claimed: false,
    timeLimitSec: 60,
    difficulty: "medium",
    noZoom: false
  };
}

test("recovery keeps the resolved round visible while the next round is pending", () => {
  const room = roomFromRankedGame(rankedGame(null), "Spieler 1", settings);

  assert.equal(room.status, "results");
  assert.equal(room.currentRound, 1);
  assert.equal(room.location?.title, "Berlin");
  assert.equal(room.guesses.length, 1);
  assert.equal(room.roundStartedAt, null);
  assert.equal(room.roundEndsAt, null);
  assert.equal(room.location?.panoramaUrl, "/api/v1/ranked-games/ranked-test/rounds/round-1/prompt");
  assert.equal(room.summaries[0]?.location.panoramaUrl, room.location?.panoramaUrl);
  assert.equal(room.settings.category, "mixed");
});

test("resolved replay uses only the opaque protected ranked image endpoint", () => {
  assert.equal(
    rankedRoundPromptUrl("ranked/id", "round id"),
    "/api/v1/ranked-games/ranked%2Fid/rounds/round%20id/prompt"
  );
  const room = roomFromRankedGame(rankedGame(null), "Spieler 1", settings);
  const replayUrl = room.summaries[0]?.location.panoramaUrl ?? "";

  assert.match(replayUrl, /^\/api\/v1\/ranked-games\//);
  assert.equal(replayUrl.includes("images.example"), false);
  assert.notEqual(replayUrl, "");
});

test("explicit next-round action reveals the pending prompt", () => {
  const game = rankedGame(null);
  const room = roomFromRankedGame(game, "Spieler 1", settings, true);

  assert.equal(room.status, "guessing");
  assert.equal(room.currentRound, 2);
  assert.match(room.location?.panoramaUrl ?? "", /round-2\/prompt/);
  assert.equal(shouldRevealPendingRankedRound(game, room), true);

  const recovered = roomFromRankedGame(game, "Spieler 1", settings, shouldRevealPendingRankedRound(game, room));
  assert.equal(recovered.status, "guessing");
  assert.equal(recovered.currentRound, 2);
});

test("a stored result does not accidentally reveal the pending prompt", () => {
  const game = rankedGame(null);
  const resultRoom = roomFromRankedGame(game, "Spieler 1", settings);

  assert.equal(shouldRevealPendingRankedRound(game, resultRoom), false);
});

test("recovery resumes an already started round with its absolute deadline", () => {
  const room = roomFromRankedGame(rankedGame(20_000), "Spieler 1", settings);

  assert.equal(room.status, "guessing");
  assert.equal(room.currentRound, 2);
  assert.equal(room.roundStartedAt, 20_000);
  assert.equal(room.roundEndsAt, 80_000);
});
