import assert from "node:assert/strict";
import test from "node:test";
import { analyticsForSaveGameEvent, initialSaveGamePromptState, shouldOfferSaveGame, transitionSaveGamePrompt } from "../lib/saveGamePrompt";

const context = {
  gameId: "game-0001",
  gameCompleted: true,
  claimed: false,
  guestSessionAvailable: true,
  integrityStatus: "verified" as const
};

test("completed anonymous game receives exactly one optional save offer", () => {
  const unseen = initialSaveGamePromptState("game-0001");
  assert.equal(shouldOfferSaveGame(unseen, context), true);
  const offered = transitionSaveGamePrompt(unseen, { type: "OFFER" });
  assert.equal(offered.status, "offered");
  assert.equal(shouldOfferSaveGame(offered, context), false);
  const dismissed = transitionSaveGamePrompt(offered, { type: "DISMISS" });
  assert.equal(dismissed.status, "dismissed");
  assert.deepEqual(transitionSaveGamePrompt(dismissed, { type: "OFFER" }), dismissed);
  assert.deepEqual(transitionSaveGamePrompt(dismissed, { type: "ACCEPT", alreadyAuthenticated: false }), dismissed);
});

test("offer is suppressed when saving is impossible or unnecessary", () => {
  const state = initialSaveGamePromptState("game-0001");
  assert.equal(shouldOfferSaveGame(state, { ...context, gameCompleted: false }), false);
  assert.equal(shouldOfferSaveGame(state, { ...context, claimed: true }), false);
  assert.equal(shouldOfferSaveGame(state, { ...context, guestSessionAvailable: false }), false);
  assert.equal(shouldOfferSaveGame(state, { ...context, integrityStatus: "invalid" }), false);
  assert.equal(shouldOfferSaveGame(state, { ...context, gameId: "game-0002" }), false);
});

test("anonymous acceptance resumes claim after OAuth and reaches saved state", () => {
  let state = transitionSaveGamePrompt(initialSaveGamePromptState("game-0001"), { type: "OFFER" });
  state = transitionSaveGamePrompt(state, { type: "ACCEPT", alreadyAuthenticated: false });
  assert.equal(state.status, "authenticating");
  state = transitionSaveGamePrompt(state, { type: "AUTH_SUCCESS" });
  assert.equal(state.status, "claiming");
  state = transitionSaveGamePrompt(state, { type: "CLAIM_SUCCESS" });
  assert.equal(state.status, "saved");
});

test("authenticated acceptance skips login and failures remain retryable or dismissible", () => {
  let state = transitionSaveGamePrompt(initialSaveGamePromptState("game-0001"), { type: "OFFER" });
  state = transitionSaveGamePrompt(state, { type: "ACCEPT", alreadyAuthenticated: true });
  assert.equal(state.status, "claiming");
  state = transitionSaveGamePrompt(state, { type: "CLAIM_FAILURE" });
  assert.deepEqual(state, { gameId: "game-0001", status: "failed", errorCode: "claim_failed" });
  state = transitionSaveGamePrompt(state, { type: "RETRY", alreadyAuthenticated: true });
  assert.equal(state.status, "claiming");
});

test("analytics mapping contains only fixed event names and no player payload", () => {
  assert.equal(analyticsForSaveGameEvent({ type: "OFFER" }), "save_prompt_view");
  assert.equal(analyticsForSaveGameEvent({ type: "DISMISS" }), "save_prompt_dismiss");
  assert.equal(analyticsForSaveGameEvent({ type: "RETRY", alreadyAuthenticated: false }), null);
});
