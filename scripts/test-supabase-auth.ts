import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { AccountIdentityService } from "../lib/accountIdentity";
import { createSupabaseAdminClient } from "../lib/supabase/admin.server";
import { SupabaseAccountIdentityRepository } from "../lib/supabase/accountIdentityRepository.server";
import type { Database } from "../lib/supabase/database.types";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url && publishableKey, "Supabase browser configuration is missing.");

  const nonce = randomUUID().replaceAll("-", "");
  const email = `auth-smoke-${nonce}@example.invalid`;
  const password = `Auth-${nonce}-9!`;
  const admin = createSupabaseAdminClient();
  let authUserId: string | null = null;
  let accountId: string | null = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    assert.ifError(createError);
    assert.ok(created.user);
    authUserId = created.user.id;

    const browser = createClient<Database>(url, publishableKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
    });
    const { data: signedIn, error: signInError } = await browser.auth.signInWithPassword({ email, password });
    assert.ifError(signInError);
    assert.equal(signedIn.user?.id, authUserId);

    const { data: claims, error: claimsError } = await browser.auth.getClaims();
    assert.ifError(claimsError);
    assert.ok(claims);
    assert.equal(claims.claims?.sub, authUserId);

    const { data: verified, error: userError } = await browser.auth.getUser();
    assert.ifError(userError);
    assert.ok(verified.user);
    const identities = new AccountIdentityService(
      new SupabaseAccountIdentityRepository(admin),
      { accountId: () => `account_${randomUUID().replaceAll("-", "")}` }
    );
    const resolved = await identities.resolve({
      authBackend: "supabase",
      backendUserId: verified.user.id,
      loginProvider: "email",
      providerSubject: verified.user.identities?.find((identity) => identity.provider === "email")?.identity_id ?? verified.user.id,
      verifiedAt: Date.parse(verified.user.last_sign_in_at ?? verified.user.created_at)
    }, Date.now());
    accountId = resolved.account.accountId;
    assert.equal(resolved.binding.backendUserId, authUserId);
    assert.equal(resolved.identity.provider, "email");

    const { data: binding, error: bindingError } = await admin
      .from("auth_bindings")
      .select("account_id")
      .eq("auth_backend", "supabase")
      .eq("backend_user_id", authUserId)
      .single();
    assert.ifError(bindingError);
    assert.equal(binding.account_id, accountId);

    const { error: signOutError } = await browser.auth.signOut({ scope: "local" });
    assert.ifError(signOutError);
    console.log("Supabase Auth smoke test passed: verified login and Punktlandung account mapping.");
  } finally {
    if (accountId) {
      const { error } = await admin.from("accounts").delete().eq("account_id", accountId);
      if (error) console.error("Auth smoke cleanup could not remove the app account.");
    }
    if (authUserId) {
      const { error } = await admin.auth.admin.deleteUser(authUserId);
      if (error) console.error("Auth smoke cleanup could not remove the auth user.");
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Supabase Auth smoke test failed.");
  process.exitCode = 1;
});
