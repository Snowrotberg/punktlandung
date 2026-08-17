import assert from "node:assert/strict";
import test from "node:test";
import { ProfileValidationError } from "../lib/accountProfile";
import { AccountProfileConflictError, InMemoryAccountProfileRepository } from "../lib/accountProfileRepository";
import { AccountProfileService } from "../lib/accountProfileService";

function service() {
  return new AccountProfileService(new InMemoryAccountProfileRepository());
}

test("authenticated account creates and changes its provider-neutral public profile", async () => {
  const profiles = service();
  const created = await profiles.create("account-0001", {
    handle: "PunktPilot",
    displayName: "Punkt Pilot",
    now: 1_000
  });
  assert.equal(created.normalizedHandle, "punktpilot");
  const updated = await profiles.update("account-0001", {
    handle: "KartenPilot",
    displayName: "  Karten   Pilot ",
    visibility: "private",
    now: 2_000
  });
  assert.equal(updated.normalizedHandle, "kartenpilot");
  assert.equal(updated.displayName, "Karten Pilot");
  assert.equal(updated.visibility, "private");
});

test("handle uniqueness is enforced atomically and old handles are released", async () => {
  const profiles = service();
  await profiles.create("account-0001", { handle: "PilotOne", displayName: "One", now: 1_000 });
  await profiles.create("account-0002", { handle: "PilotTwo", displayName: "Two", now: 1_000 });
  await assert.rejects(
    profiles.update("account-0002", { handle: "PILOTONE", now: 2_000 }),
    (error: unknown) => error instanceof AccountProfileConflictError && error.code === "handle_taken"
  );
  await profiles.update("account-0001", { handle: "PilotThree", now: 3_000 });
  const reused = await profiles.update("account-0002", { handle: "PilotOne", now: 4_000 });
  assert.equal(reused.normalizedHandle, "pilotone");
});

test("deleted profiles are idempotent and cannot be edited", async () => {
  const profiles = service();
  await profiles.create("account-0001", { handle: "PilotOne", displayName: "One", now: 1_000 });
  const deleted = await profiles.delete("account-0001", 2_000);
  assert.deepEqual((await profiles.delete("account-0001", 3_000)), deleted);
  await assert.rejects(
    profiles.update("account-0001", { displayName: "Back", now: 4_000 }),
    (error: unknown) => error instanceof ProfileValidationError && error.code === "inactive_profile"
  );
});

test("profile lookup and duplicate creation use stable conflict codes", async () => {
  const profiles = service();
  await assert.rejects(
    profiles.get("account-missing"),
    (error: unknown) => error instanceof AccountProfileConflictError && error.code === "profile_missing"
  );
  await profiles.create("account-0001", { handle: "PilotOne", displayName: "One", now: 1_000 });
  await assert.rejects(
    profiles.create("account-0001", { handle: "Another", displayName: "One", now: 2_000 }),
    (error: unknown) => error instanceof AccountProfileConflictError && error.code === "profile_exists"
  );
});
