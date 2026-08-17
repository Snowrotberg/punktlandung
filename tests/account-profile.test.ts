import assert from "node:assert/strict";
import test from "node:test";
import { createPublicProfile, deletePublicProfile, normalizeHandle, ProfileValidationError, toPublicProfileView, validateDisplayName, validateHandle } from "../lib/accountProfile";

test("handle normalization is stable and case insensitive", () => {
  assert.equal(normalizeHandle("  Atlas_Ä  "), "atlas_ä");
  assert.deepEqual(validateHandle("Atlas_Ä"), { handle: "Atlas_Ä", normalizedHandle: "atlas_ä" });
});

test("invalid and reserved public handles are rejected", () => {
  for (const handle of ["ab", "has space", "bad/route", "x".repeat(25)]) {
    assert.throws(() => validateHandle(handle), (error: unknown) => error instanceof ProfileValidationError && error.code === "invalid_handle");
  }
  assert.throws(() => validateHandle("Punktlandung"), (error: unknown) => error instanceof ProfileValidationError && error.code === "reserved_handle");
});

test("display names collapse whitespace without becoming a login identifier", () => {
  assert.equal(validateDisplayName("  Atlas   Meister  "), "Atlas Meister");
  assert.throws(() => validateDisplayName("\u0000hidden"), ProfileValidationError);
});

test("profile creation keeps public identity separate from provider data", () => {
  const profile = createPublicProfile({
    accountId: "account-12345678",
    handle: "Atlas",
    displayName: "Atlas Meister",
    now: 1_000
  });
  assert.equal(profile.normalizedHandle, "atlas");
  assert.equal("email" in profile, false);
  assert.equal("providerSubject" in profile, false);
});

test("profile deletion is idempotent and removes public presentation", () => {
  const profile = createPublicProfile({
    accountId: "account-12345678",
    handle: "Atlas",
    displayName: "Atlas Meister",
    now: 1_000
  });
  const deleted = deletePublicProfile(profile, 2_000);
  assert.equal(deleted.handle, "deleted-account12345678");
  assert.equal(deleted.displayName, "Gelöschter Spieler");
  assert.equal(deleted.visibility, "private");
  assert.equal(deleted.status, "deleted");
  assert.equal(deletePublicProfile(deleted, 3_000), deleted);
});

test("public profile projection removes account and moderation identifiers", () => {
  const profile = createPublicProfile({
    accountId: "private-account-id",
    handle: "AtlasOne",
    displayName: "Atlas",
    now: 1_000
  });
  const view = toPublicProfileView(profile);
  assert.deepEqual(view, { handle: "AtlasOne", displayName: "Atlas", avatarKey: null });
  assert.equal(JSON.stringify(view).includes("private-account-id"), false);
  assert.equal(toPublicProfileView({ ...profile, visibility: "private" }), null);
  assert.equal(toPublicProfileView({ ...profile, status: "restricted" }), null);
});
