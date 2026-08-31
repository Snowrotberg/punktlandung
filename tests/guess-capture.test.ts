import assert from "node:assert/strict";
import test from "node:test";
import {
  captureIsWithinDeadline,
  captureMatchesRoom,
  guessFromCapture,
  serverObservedCaptureBeforeDeadline,
  type GuessCapture
} from "../lib/guessCapture";
import type { RoomState } from "../types/game";

const startedAt = 10_000;
const deadlineAt = 70_000;

function capture(offsetMs: number, overrides: Partial<GuessCapture> = {}): GuessCapture {
  return {
    point: { lat: 52.5, lng: 13.4 },
    playerId: "player-1",
    roundNumber: 3,
    locationId: "berlin",
    roundStartedAt: startedAt,
    roundEndsAt: deadlineAt,
    capturedAt: deadlineAt + offsetMs,
    capturedAtMonotonic: 42_000 + offsetMs,
    ...overrides
  };
}

const room = {
  status: "guessing",
  currentRound: 3,
  location: { id: "berlin" },
  roundStartedAt: startedAt,
  roundEndsAt: deadlineAt
} as RoomState;

test("the exact deadline is inclusive and the first millisecond after it is rejected", () => {
  for (const offset of [-2_000, -500, -50, 0]) assert.equal(captureIsWithinDeadline(capture(offset)), true, `${offset}ms`);
  assert.equal(captureIsWithinDeadline(capture(50)), false);
});

test("captures are bound to the immutable round, location and player", () => {
  assert.equal(captureMatchesRoom(room, capture(-50)), true);
  assert.equal(captureMatchesRoom(room, capture(-50, { roundNumber: 4 })), false);
  assert.equal(captureMatchesRoom(room, capture(-50, { locationId: "other" })), false);
  assert.equal(captureMatchesRoom(room, capture(-50), "player-2"), false);
});

test("the last valid capture can be evaluated after a throttled 3 second callback", () => {
  const snapshots = [capture(-2_000), capture(-500), capture(-50)];
  const last = snapshots.filter(captureIsWithinDeadline).at(-1)!;
  const evaluatedThreeSecondsLater = guessFromCapture(last);
  assert.equal(evaluatedThreeSecondsLater.createdAt, deadlineAt - 50);
  assert.equal(evaluatedThreeSecondsLater.responseTimeMs, deadlineAt - 50 - startedAt);
  assert.deepEqual({ lat: evaluatedThreeSecondsLater.lat, lng: evaluatedThreeSecondsLater.lng }, last.point);
});

test("online authorization uses only the server receive time", () => {
  assert.equal(serverObservedCaptureBeforeDeadline(startedAt, deadlineAt, deadlineAt - 500), true);
  assert.equal(serverObservedCaptureBeforeDeadline(startedAt, deadlineAt, deadlineAt), true, "the exact server deadline is inclusive");
  assert.equal(serverObservedCaptureBeforeDeadline(startedAt, deadlineAt, deadlineAt + 1), false, "a late frame is rejected regardless of any client timestamp");
  assert.equal(serverObservedCaptureBeforeDeadline(startedAt, deadlineAt, startedAt - 1), false);
});
