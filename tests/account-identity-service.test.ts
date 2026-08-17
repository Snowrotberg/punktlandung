import assert from "node:assert/strict";
import test from "node:test";
import { AccountIdentityError, AccountIdentityService, InMemoryAccountIdentityRepository, type ExternalAuthPrincipal } from "../lib/accountIdentity";
import type { VerifiedAccountSession } from "../lib/accountSession.server";

const principal: ExternalAuthPrincipal = {
  authBackend: "supabase", backendUserId: "backend-user-0001", loginProvider: "google",
  providerSubject: "google-subject-0001", verifiedAt: 1_000
};

test("identity service generates app IDs once and never uses provider UID as ownership", async () => {
  let next = 0;
  const service = new AccountIdentityService(new InMemoryAccountIdentityRepository(), {
    accountId: () => `account-${String(++next).padStart(4, "0")}`
  });
  const first = await service.resolve(principal, 2_000);
  const retry = await service.resolve(principal, 3_000);
  assert.equal(first.account.accountId, "account-0001");
  assert.equal(retry.account.accountId, "account-0001");
});

test("linking a new method requires fresh authentication within the existing session", async () => {
  const repository = new InMemoryAccountIdentityRepository();
  const service = new AccountIdentityService(repository, { accountId: () => "account-0001" });
  const resolved = await service.resolve(principal, 2_000);
  const session: VerifiedAccountSession = {
    accountId: resolved.account.accountId, sessionId: "session-0001", provider: "google",
    authenticatedAt: 2_000, expiresAt: 100_000
  };
  const email: ExternalAuthPrincipal = {
    authBackend: "supabase", backendUserId: "backend-user-0002", loginProvider: "email",
    providerSubject: "email-subject-0001", verifiedAt: 20_000
  };
  await assert.rejects(
    service.link(session, email, 700_001),
    (error: unknown) => error instanceof AccountIdentityError && error.code === "reauthentication_required"
  );
  const linked = await service.link(session, { ...email, verifiedAt: 20_000 }, 20_001);
  assert.equal(linked.account.accountId, session.accountId);
});
