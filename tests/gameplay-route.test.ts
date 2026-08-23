import assert from "node:assert/strict";
import test from "node:test";
import { gameplayRouteForStatus, gameplayStatusForRoute } from "../lib/gameplayRoute";

test("every active game status has one canonical route", () => {
  assert.equal(gameplayRouteForStatus("guessing"), "/spielen");
  assert.equal(gameplayRouteForStatus("results"), "/aufloesung");
  assert.equal(gameplayRouteForStatus("finished"), "/endergebnis");
});

test("lobbies and explicit setup resume offers stay on the setup route", () => {
  assert.equal(gameplayRouteForStatus("lobby"), null);
  assert.equal(gameplayRouteForStatus(undefined), null);
  assert.equal(gameplayRouteForStatus("guessing", true), null);
  assert.equal(gameplayRouteForStatus("results", true), null);
  assert.equal(gameplayRouteForStatus("finished", true), null);
});

test("gameplay routes map back to their required state", () => {
  assert.equal(gameplayStatusForRoute("/spielen"), "guessing");
  assert.equal(gameplayStatusForRoute("/aufloesung"), "results");
  assert.equal(gameplayStatusForRoute("/endergebnis"), "finished");
  assert.equal(gameplayStatusForRoute("/solo-modus"), null);
});
