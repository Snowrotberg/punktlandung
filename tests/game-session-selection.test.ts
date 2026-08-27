import assert from "node:assert/strict";
import test from "node:test";
import {
  isServerRankedSoloRoom,
  preferLocalRequiredSession,
  shouldOfferSetupResume,
  shouldRestoreLocalSession,
  shouldRestoreRankedSoloSession,
  shouldUseRankedSoloSession
} from "../lib/gameSessionSelection";

test("authenticated result route waits for browser-local guest restoration", () => {
  assert.equal(preferLocalRequiredSession("finished", true, undefined), true);
});

test("finished browser-local guest game keeps priority after login", () => {
  assert.equal(preferLocalRequiredSession("finished", false, "finished"), true);
});

test("local lobby allows the ranked account session", () => {
  assert.equal(preferLocalRequiredSession("finished", false, "lobby"), false);
});

test("browser-local gameplay keeps ownership while its route status changes", () => {
  assert.equal(preferLocalRequiredSession("guessing", false, "results"), true);
  assert.equal(preferLocalRequiredSession("results", false, "finished"), true);
});

test("normal setup routes do not force a browser-local result session", () => {
  assert.equal(preferLocalRequiredSession(undefined, true, "finished"), false);
});

test("normal solo setup and direct play never auto-restore an older ranked game", () => {
  assert.equal(shouldRestoreRankedSoloSession(undefined, false), false);
  assert.equal(shouldRestoreRankedSoloSession("guessing", false), true);
  assert.equal(shouldRestoreRankedSoloSession(undefined, true), true);
});

test("direct local route restores its active round and absolute deadline on reload", () => {
  assert.equal(shouldRestoreLocalSession(undefined, false), false);
  assert.equal(shouldRestoreLocalSession(undefined, true), true);
  assert.equal(shouldRestoreLocalSession("guessing", false), true);
});

test("direct play returns to setup with an explicit resume offer", () => {
  assert.equal(shouldOfferSetupResume(undefined, false, true), true);
  assert.equal(shouldOfferSetupResume("guessing", false, false), true);
  assert.equal(shouldOfferSetupResume(undefined, true, false), true);
  assert.equal(shouldOfferSetupResume(undefined, false, false), false);
});

test("rankings-enabled guests use the server-backed solo flow", () => {
  assert.equal(shouldUseRankedSoloSession({
    rankedGamesEnabled: true,
    resumeRankedGame: false,
    routeAllowsRankedSolo: true,
    localSessionHasPriority: false,
    onSoloFlow: true
  }), true);
});

test("party routes and explicit legacy-local recovery keep local ownership", () => {
  assert.equal(shouldUseRankedSoloSession({
    rankedGamesEnabled: true,
    resumeRankedGame: false,
    routeAllowsRankedSolo: false,
    localSessionHasPriority: false,
    onSoloFlow: true
  }), false);
  assert.equal(shouldUseRankedSoloSession({
    rankedGamesEnabled: true,
    resumeRankedGame: false,
    routeAllowsRankedSolo: true,
    localSessionHasPriority: true,
    onSoloFlow: true
  }), false);
});

test("ranked room provenance survives a transient hook-selection change", () => {
  assert.equal(isServerRankedSoloRoom({ code: "RANKED", kind: "solo", settings: { localMode: "solo" } }), true);
  assert.equal(isServerRankedSoloRoom({ code: "LOKAL", kind: "solo", settings: { localMode: "solo" } }), false);
  assert.equal(isServerRankedSoloRoom({ code: "RANKED", kind: "party", settings: { localMode: "couch" } }), false);
});
