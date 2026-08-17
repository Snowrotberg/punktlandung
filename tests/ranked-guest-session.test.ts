import assert from "node:assert/strict";
import test from "node:test";
import { RankedGuestSessionCodec, RankedGuestSessionError } from "../lib/rankedGuestSession.server";

const currentSecret = "current-ranked-session-secret-32-characters";
const previousSecret = "previous-ranked-session-secret-32-characters";

test("guest session is signed and resolves to a stable persistence hash", () => {
  const codec = new RankedGuestSessionCodec([currentSecret], 60_000);
  const issued = codec.issue(1_000);
  const verified = codec.verify(issued.token, 30_000);
  assert.deepEqual(verified, issued.session);
  assert.match(verified.guestIdHash, /^[a-f0-9]{64}$/);
  assert.equal(issued.token.includes(verified.guestIdHash), false);
});

test("guest session rejects tampering and expiration", () => {
  const codec = new RankedGuestSessionCodec([currentSecret], 60_000);
  const issued = codec.issue(1_000);
  const tampered = `${issued.token.slice(0, -1)}${issued.token.endsWith("A") ? "B" : "A"}`;
  assert.throws(() => codec.verify(tampered, 2_000), (error: unknown) => (
    error instanceof RankedGuestSessionError && error.code === "invalid"
  ));
  assert.throws(() => codec.verify(issued.token, 61_000), (error: unknown) => (
    error instanceof RankedGuestSessionError && error.code === "expired"
  ));
});

test("previous signing secret preserves active games during rotation", () => {
  const oldCodec = new RankedGuestSessionCodec([previousSecret], 60_000);
  const issued = oldCodec.issue(1_000);
  const rotatingCodec = new RankedGuestSessionCodec([currentSecret, previousSecret], 60_000);
  assert.equal(rotatingCodec.verify(issued.token, 2_000).guestIdHash, issued.session.guestIdHash);
});

test("weak secrets and excessive lifetimes are rejected", () => {
  assert.throws(() => new RankedGuestSessionCodec(["too-short"]));
  assert.throws(() => new RankedGuestSessionCodec([currentSecret], 8 * 24 * 60 * 60 * 1000));
});
