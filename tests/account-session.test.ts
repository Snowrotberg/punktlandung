import assert from "node:assert/strict";
import test from "node:test";
import { AccountSessionError, validateAccountSession, type VerifiedAccountSession } from "../lib/accountSession.server";

function session(overrides: Partial<VerifiedAccountSession> = {}): VerifiedAccountSession {
  return {
    accountId: "account-0001",
    sessionId: "session-0001",
    provider: "google",
    authenticatedAt: 1_000,
    expiresAt: 100_000,
    ...overrides
  };
}

test("normalized account sessions support email, Google and Apple", () => {
  for (const provider of ["email", "google", "apple"] as const) {
    assert.equal(validateAccountSession(session({ provider }), 2_000).provider, provider);
  }
});

test("normalized account sessions reject expiry, future auth and malformed IDs", () => {
  assert.throws(() => validateAccountSession(session(), 100_000), (error: unknown) => (
    error instanceof AccountSessionError && error.code === "expired"
  ));
  assert.throws(() => validateAccountSession(session({ authenticatedAt: 100_000 }), 1_000), AccountSessionError);
  assert.throws(() => validateAccountSession(session({ sessionId: "bad" }), 2_000), AccountSessionError);
});
