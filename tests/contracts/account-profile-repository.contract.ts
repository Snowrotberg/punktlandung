import assert from "node:assert/strict";
import test from "node:test";
import { createPublicProfile, updatePublicProfile, type PublicProfile } from "../../lib/accountProfile";
import { AccountProfileConflictError, type AccountProfileRepository } from "../../lib/accountProfileRepository";

export type AccountProfileRepositoryFactory = () => Promise<AccountProfileRepository> | AccountProfileRepository;

function profile(accountId: string, handle: string, now = 1_000): PublicProfile {
  return createPublicProfile({ accountId, handle, displayName: handle, now });
}

function conflict(code: AccountProfileConflictError["code"]) {
  return (error: unknown) => error instanceof AccountProfileConflictError && error.code === code;
}

/** Register unchanged against every Supabase or Firebase profile adapter. */
export function accountProfileRepositoryContract(label: string, factory: AccountProfileRepositoryFactory): void {
  test(`${label}: account and normalized handle lookups agree`, async () => {
    const repository = await factory();
    const created = await repository.create(profile("account-0001", "AtlasOne"));
    assert.deepEqual(await repository.findByAccountId("account-0001"), created);
    assert.deepEqual(await repository.findByNormalizedHandle("atlasone"), created);
    assert.equal(await repository.findByNormalizedHandle("missing"), null);
  });

  test(`${label}: concurrent handle claims have exactly one winner`, async () => {
    const repository = await factory();
    const results = await Promise.allSettled([
      repository.create(profile("account-0001", "SharedHandle")),
      repository.create(profile("account-0002", "SharedHandle"))
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    assert.ok(rejected && conflict("handle_taken")(rejected.reason));
  });

  test(`${label}: atomic handle move releases old claim without overwriting another owner`, async () => {
    const repository = await factory();
    await repository.create(profile("account-0001", "FirstHandle"));
    await repository.create(profile("account-0002", "SecondHandle"));
    await assert.rejects(repository.updateAtomically("account-0002", (current) => (
      updatePublicProfile(current, { handle: "FirstHandle", now: 2_000 })
    )), conflict("handle_taken"));
    await repository.updateAtomically("account-0001", (current) => (
      updatePublicProfile(current, { handle: "ThirdHandle", now: 3_000 })
    ));
    const reused = await repository.updateAtomically("account-0002", (current) => (
      updatePublicProfile(current, { handle: "FirstHandle", now: 4_000 })
    ));
    assert.equal(reused.normalizedHandle, "firsthandle");
  });

  test(`${label}: returned objects are isolated and identity is immutable`, async () => {
    const repository = await factory();
    const input = profile("account-0001", "AtlasOne");
    await repository.create(input);
    input.displayName = "mutated input";
    const read = await repository.findByAccountId("account-0001");
    assert.equal(read?.displayName, "AtlasOne");
    if (!read) throw new Error("missing profile");
    read.displayName = "mutated output";
    assert.equal((await repository.findByAccountId("account-0001"))?.displayName, "AtlasOne");
    await assert.rejects(repository.updateAtomically("account-0001", (current) => ({
      ...current,
      accountId: "account-hijacked"
    })));
  });

  test(`${label}: missing and duplicate accounts use stable conflict codes`, async () => {
    const repository = await factory();
    await assert.rejects(repository.updateAtomically("missing-account", (current) => current), conflict("profile_missing"));
    await repository.create(profile("account-0001", "AtlasOne"));
    await assert.rejects(repository.create(profile("account-0001", "OtherHandle")), conflict("profile_exists"));
  });
}
