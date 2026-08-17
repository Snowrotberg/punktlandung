import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createPublicProfile, updatePublicProfile } from "../lib/accountProfile";
import type { AccountRecord, ExternalAuthPrincipal } from "../lib/accountIdentity";
import { createSupabaseAdminClient } from "../lib/supabase/admin.server";
import { SupabaseAccountIdentityRepository } from "../lib/supabase/accountIdentityRepository.server";
import { SupabaseAccountProfileRepository } from "../lib/supabase/accountProfileRepository.server";
import { SupabaseRankedGameRepository } from "../lib/supabase/rankedGameRepository.server";
import { createRankedGame, submitRankedGuess } from "../lib/rankedGame";
import { builtInLocations } from "../data/locations";
import type { Database } from "../lib/supabase/database.types";

const suffix = randomUUID().replaceAll("-", "");
const accountOne = `testacct_${suffix}`;
const accountTwo = `testalt_${suffix}`;
const backendUserId = `test-user-${suffix}`;
const providerSubject = `test-subject-${suffix}`;
const now = Date.now();
const rankedGameId = `ranked_test_${suffix}`;

const principal: ExternalAuthPrincipal = {
  authBackend: "supabase",
  backendUserId,
  loginProvider: "email",
  providerSubject,
  verifiedAt: now
};

function account(accountId: string, timestamp = now): AccountRecord {
  return { accountId, status: "active", createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
}

async function main() {
  const admin = createSupabaseAdminClient();
  const identities = new SupabaseAccountIdentityRepository(admin);
  const profiles = new SupabaseAccountProfileRepository(admin);
  const rankedGames = new SupabaseRankedGameRepository(admin);

  try {
    const concurrent = await Promise.all([
    identities.resolveAtomically(principal, account(accountOne), now),
    identities.resolveAtomically(principal, account(accountTwo), now)
  ]);
  assert.equal(new Set(concurrent.map((result) => result.account.accountId)).size, 1);
  assert.equal(concurrent.filter((result) => result.accountCreated).length, 1);
  const accountId = concurrent[0].account.accountId;

  const retry = await identities.resolveAtomically(principal, account(accountTwo, now + 1_000), now + 1_000);
  assert.equal(retry.account.accountId, accountId);
  assert.equal(retry.accountCreated, false);
  assert.deepEqual((await identities.listIdentities(accountId)).map((identity) => identity.provider), ["email"]);

  const created = await profiles.create(createPublicProfile({
    accountId,
    handle: `Test${suffix.slice(0, 12)}`,
    displayName: "Supabase Test",
    visibility: "private",
    now
  }));
  assert.equal((await profiles.findByAccountId(accountId))?.handle, created.handle);

  const updated = await profiles.updateAtomically(accountId, (current) => updatePublicProfile(current, {
    displayName: "Supabase Test Updated",
    now: now + 2_000
  }));
  assert.equal(updated.displayName, "Supabase Test Updated");

  const publicClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  const browserRead = await publicClient.from("profiles").select("account_id").limit(1);
  assert.ok(browserRead.error, "Publishable browser client unexpectedly read private application tables.");

  const ranked = createRankedGame({
    gameId: rankedGameId,
    createRequestId: `start_test_${suffix}`,
    guestIdHash: `guest_hash_${suffix}`,
    locations: [builtInLocations[0]],
    roundIds: [`round_test_${suffix}`],
    now,
    roundDurationMs: 60_000
  });
  await rankedGames.create(ranked);
  const completed = await rankedGames.updateAtomically(rankedGameId, (current) => submitRankedGuess(current, {
    roundId: current.rounds[0].roundId,
    guessId: `guess_test_${suffix}`,
    point: { lat: 0, lng: 0 },
    now: now + 2_000
  }));
  assert.equal(completed.status, "completed");
  assert.equal((await rankedGames.findById(rankedGameId))?.rounds[0].guess?.lat, 0);

    console.log("Supabase adapter smoke test passed: identity, profile CAS, ranked-state transaction and browser isolation.");
  } finally {
    await admin.from("ranked_games").delete().eq("game_id", rankedGameId);
    await admin.from("accounts").delete().in("account_id", [accountOne, accountTwo]);
  }
}

void main();
