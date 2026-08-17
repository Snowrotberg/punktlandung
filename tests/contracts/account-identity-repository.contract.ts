import assert from "node:assert/strict";
import test from "node:test";
import { AccountIdentityError, type AccountIdentityRepository, type AccountRecord, type ExternalAuthPrincipal } from "../../lib/accountIdentity";

export type AccountIdentityRepositoryFactory = () => Promise<AccountIdentityRepository> | AccountIdentityRepository;

const google: ExternalAuthPrincipal = {
  authBackend: "supabase",
  backendUserId: "supabase-user-0001",
  loginProvider: "google",
  providerSubject: "google-subject-0001",
  verifiedAt: 1_000
};

function account(accountId: string, now = 2_000): AccountRecord {
  return { accountId, status: "active", createdAt: now, updatedAt: now, deletedAt: null };
}

export function accountIdentityRepositoryContract(label: string, factory: AccountIdentityRepositoryFactory): void {
  test(`${label}: first login creates an app-owned account independent of backend UID`, async () => {
    const repository = await factory();
    const resolved = await repository.resolveAtomically(google, account("account-0001"), 2_000);
    assert.equal(resolved.accountCreated, true);
    assert.equal(resolved.account.accountId, "account-0001");
    assert.notEqual(resolved.account.accountId, google.backendUserId);
    assert.equal(resolved.binding.accountId, resolved.account.accountId);
    assert.equal(resolved.identity.accountId, resolved.account.accountId);
  });

  test(`${label}: retries and a migrated auth backend preserve the same account`, async () => {
    const repository = await factory();
    const first = await repository.resolveAtomically(google, account("account-0001"), 2_000);
    const retry = await repository.resolveAtomically(google, account("account-0002"), 3_000);
    assert.equal(retry.account.accountId, first.account.accountId);
    assert.equal(retry.accountCreated, false);
    const migrated = await repository.resolveAtomically({
      ...google,
      authBackend: "firebase",
      backendUserId: "firebase-user-0001"
    }, account("account-0003"), 4_000);
    assert.equal(migrated.account.accountId, first.account.accountId);
  });

  test(`${label}: linking adds methods but cannot steal another account's identity`, async () => {
    const repository = await factory();
    await repository.resolveAtomically(google, account("account-0001"), 2_000);
    const email: ExternalAuthPrincipal = {
      authBackend: "supabase",
      backendUserId: "supabase-user-0002",
      loginProvider: "email",
      providerSubject: "email-identity-0001",
      verifiedAt: 2_500
    };
    await repository.linkAtomically("account-0001", email, 3_000);
    assert.deepEqual((await repository.listIdentities("account-0001")).map((identity) => identity.provider), ["email", "google"]);
    await repository.resolveAtomically({ ...email, backendUserId: "other-backend-user", providerSubject: "email-identity-0002" }, account("account-0002"), 3_100);
    await assert.rejects(
      repository.linkAtomically("account-0002", google, 4_000),
      (error: unknown) => error instanceof AccountIdentityError && error.code === "identity_conflict"
    );
  });

  test(`${label}: concurrent resolution of one principal yields one account`, async () => {
    const repository = await factory();
    const results = await Promise.all([
      repository.resolveAtomically(google, account("account-0001"), 2_000),
      repository.resolveAtomically(google, account("account-0002"), 2_000)
    ]);
    assert.equal(new Set(results.map((result) => result.account.accountId)).size, 1);
  });
}
