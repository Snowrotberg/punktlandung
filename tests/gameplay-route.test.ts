import assert from "node:assert/strict";
import test from "node:test";
import {
  gameplayRouteForStatus,
  gameplayStatusForRoute,
  shouldShowGameplayRestoration,
  shouldShowGameplayStateGuard,
  shouldSynchronizeGameplayRoute
} from "../lib/gameplayRoute";

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

test("intentional final-screen exits never expose the state guard between route and lobby", () => {
  const base = {
    requiredStatus: "finished" as const,
    currentStatus: "lobby" as const,
    restorationPending: false,
    gameplayRouteMismatch: false
  };

  assert.equal(shouldShowGameplayStateGuard({ ...base, intentionalExitPending: false }), true);
  assert.equal(shouldShowGameplayStateGuard({ ...base, intentionalExitPending: true }), false);
});

test("gameplay restoration never falls through to a previous or setup surface", () => {
  assert.equal(shouldShowGameplayRestoration({
    requiredStatus: "results",
    currentStatus: undefined,
    restorationPending: true
  }), true);
  assert.equal(shouldShowGameplayRestoration({
    requiredStatus: "results",
    currentStatus: "lobby",
    restorationPending: true
  }), true);
  assert.equal(shouldShowGameplayRestoration({
    requiredStatus: "results",
    currentStatus: "results",
    restorationPending: true
  }), false);
  assert.equal(shouldShowGameplayRestoration({
    requiredStatus: "results",
    currentStatus: undefined,
    restorationPending: false
  }), false);
  assert.equal(shouldShowGameplayRestoration({
    requiredStatus: null,
    currentStatus: undefined,
    restorationPending: true
  }), false);
});

test("route synchronization enters gameplay from setup and repairs later transitions", () => {
  const base = {
    targetRoute: "/endergebnis",
    restorationPending: false,
    intentionalExitPending: false
  };

  assert.equal(shouldSynchronizeGameplayRoute({ ...base, pathname: "/aufloesung" }), true);
  assert.equal(shouldSynchronizeGameplayRoute({ ...base, pathname: "/solo-modus" }), true);
  assert.equal(shouldSynchronizeGameplayRoute({ ...base, pathname: "/solo-modus/direct" }), true);
  assert.equal(shouldSynchronizeGameplayRoute({ ...base, pathname: "/party-modus" }), true);
  assert.equal(shouldSynchronizeGameplayRoute({ ...base, pathname: "/online-modus" }), true);
  assert.equal(shouldSynchronizeGameplayRoute({ ...base, pathname: "/warteraum" }), true);
  assert.equal(shouldSynchronizeGameplayRoute({ ...base, pathname: "/" }), false);
  assert.equal(shouldSynchronizeGameplayRoute({ ...base, pathname: "/endergebnis" }), false);
  assert.equal(shouldSynchronizeGameplayRoute({ ...base, pathname: "/aufloesung", restorationPending: true }), false);
  assert.equal(shouldSynchronizeGameplayRoute({ ...base, pathname: "/aufloesung", intentionalExitPending: true }), false);
});
