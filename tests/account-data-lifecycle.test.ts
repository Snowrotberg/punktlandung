import assert from "node:assert/strict";
import test from "node:test";
import { createAccountDataExport, createAccountDeletionRequest, AccountLifecycleError } from "../lib/accountDataLifecycle";
import { createPublicProfile, type AccountIdentity } from "../lib/accountProfile";
import { captureRankedGuess, claimRankedGame, createRankedGame, submitRankedGuess } from "../lib/rankedGame";
import type { GeoLocation } from "../types/game";

function claimedGame() {
  const location: GeoLocation = {
    id: "location-0001", title: "Berlin", countryCode: "DE", countryName: "Deutschland",
    continent: "Europe", lat: 52.52, lng: 13.405, panoramaUrl: "https://images.example/berlin.jpg",
    attribution: "Test", source: "ugc", category: "cities"
  };
  const active = createRankedGame({
    gameId: "game-0001", createRequestId: "request-0001", guestIdHash: "private-guest-hash",
    locations: [location], roundIds: ["round-0001"], now: 1_000, roundDurationMs: 60_000
  });
  const captured = captureRankedGuess(active, { guessId: "guess-0001", roundId: "round-0001", point: { lat: 52, lng: 13 }, now: 2_000 });
  const complete = submitRankedGuess(captured, { guessId: "guess-0001", roundId: "round-0001", now: 2_000 });
  return claimRankedGame(complete, "account-0001");
}

test("account export contains only one owner's portable data and no guest secret", () => {
  const profile = createPublicProfile({ accountId: "account-0001", handle: "AtlasOne", displayName: "Atlas", now: 1_000 });
  const identity: AccountIdentity = {
    accountId: "account-0001", provider: "google", providerSubject: "google-subject", verifiedAt: 1_000, lastUsedAt: 2_000
  };
  const exported = createAccountDataExport({
    accountId: "account-0001", profile, loginIdentities: [identity], rankedGames: [claimedGame()],
    authentication: { currentEmail: "atlas@example.com", pendingEmail: null, providers: ["google"], lastSignInAt: 2_000 },
    now: 3_000
  });
  assert.equal(exported.schemaVersion, 2);
  assert.equal(exported.authentication.currentEmail, "atlas@example.com");
  assert.equal(exported.rankedGames[0].claimed, true);
  assert.equal(JSON.stringify(exported).includes("private-guest-hash"), false);
  assert.equal(JSON.stringify(exported).includes("request-0001"), false);
});

test("account export rejects mixed-owner data", () => {
  const profile = createPublicProfile({ accountId: "account-0002", handle: "AtlasTwo", displayName: "Atlas", now: 1_000 });
  assert.throws(() => createAccountDataExport({
    accountId: "account-0001", profile, loginIdentities: [], rankedGames: [],
    authentication: { currentEmail: null, pendingEmail: null, providers: [], lastSignInAt: null }, now: 2_000
  }), (error: unknown) => error instanceof AccountLifecycleError && error.code === "identity_mismatch");
});

test("account deletion requires a recent reauthentication and creates a durable job", () => {
  const request = createAccountDeletionRequest({
    deletionRequestId: "delete-request-0001",
    accountId: "account-0001",
    requestedAt: 700_000,
    reauthenticatedAt: 100_000
  });
  assert.equal(request.status, "queued");
  assert.throws(() => createAccountDeletionRequest({
    deletionRequestId: "delete-request-0002",
    accountId: "account-0001",
    requestedAt: 700_001,
    reauthenticatedAt: 100_000
  }), (error: unknown) => error instanceof AccountLifecycleError && error.code === "reauthentication_required");
});
