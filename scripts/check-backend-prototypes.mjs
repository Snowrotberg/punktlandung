import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../prototypes/backend-evaluation/", import.meta.url);
const [schema, rankingSql, firestoreRules, firestoreModel, indexesRaw] = await Promise.all([
  readFile(new URL("supabase/schema.sql", root), "utf8"),
  readFile(new URL("supabase/leaderboard-query.sql", root), "utf8"),
  readFile(new URL("firebase/firestore.rules", root), "utf8"),
  readFile(new URL("firebase/model.md", root), "utf8"),
  readFile(new URL("firebase/firestore.indexes.json", root), "utf8")
]);

function includes(text, fragment, label) {
  assert.ok(text.includes(fragment), `${label}: missing ${JSON.stringify(fragment)}`);
}

const tables = [
  "accounts",
  "auth_bindings",
  "login_identities",
  "profiles",
  "ranked_games",
  "ranked_rounds",
  "ranked_guesses",
  "moderation_events",
  "account_deletion_jobs",
  "leaderboard_entries"
];

for (const table of tables) {
  includes(schema, `create table public.${table}`, "Supabase schema");
  includes(schema, `alter table public.${table} enable row level security`, "Supabase RLS");
  includes(schema, `revoke all on public.${table} from anon, authenticated`, "Supabase browser isolation");
}

assert.doesNotMatch(schema, /create policy\s+/i, "Browser-facing SQL policies would bypass the provider-neutral API.");
assert.doesNotMatch(schema, /references\s+auth\.users/i, "App account IDs must not depend on Supabase auth.users IDs.");
includes(schema, "references public.accounts(account_id)", "Supabase app-owned identity");
includes(schema, "primary key (auth_backend, backend_user_id)", "Supabase auth binding uniqueness");
includes(schema, "unique (provider, provider_subject)", "Supabase login identity uniqueness");
includes(schema, "foreign key (round_id, game_id)", "Supabase round/guess integrity");
includes(schema, "guest_id_hash is null and expires_at is null", "Supabase claimed guest cleanup");
includes(schema, "profile.visibility = 'public'", "Supabase public ranking privacy");
includes(schema, "profile.status = 'active'", "Supabase active ranking privacy");
includes(schema, "game.integrity_status = 'verified'", "Supabase verified ranking source");

for (const fragment of [
  "row_number() over",
  "partition by result.account_id",
  "game_rank <= :game_limit",
  "result.completed_at >= :period_start",
  "result.completed_at < :period_end",
  "result.ruleset_version = :ruleset_version",
  "result.scoring_version = :scoring_version"
]) includes(rankingSql, fragment, "Supabase leaderboard query");

assert.doesNotMatch(firestoreRules, /allow\s+(?:read|write|read,\s*write)\s*:\s*if\s+true/i,
  "Firestore must not expose application collections directly.");
for (const path of [
  "/accounts/{accountId}",
  "/authBindings/{bindingId}",
  "/loginIdentities/{identityId}",
  "/profiles/{accountId}",
  "/handleClaims/{normalizedHandle}",
  "/rankedGames/{gameId}",
  "/leaderboards/{scope}/entries/{accountId}",
  "/moderationEvents/{eventId}",
  "/accountDeletionJobs/{deletionRequestId}"
]) includes(firestoreRules, `match ${path}`, "Firestore rules");
assert.equal((firestoreRules.match(/allow read, write: if false;/g) ?? []).length, 9,
  "Every Firestore application collection must deny direct browser reads and writes.");

for (const concept of ["accounts", "authBindings", "loginIdentities", "handleClaims", "accountDeletionJobs", "72 Stunden", "PublicLeaderboardEntry"]) {
  includes(firestoreModel, concept, "Firestore model");
}

const indexes = JSON.parse(indexesRaw);
assert.ok(Array.isArray(indexes.indexes) && indexes.indexes.length >= 2, "Firestore index prototype is incomplete.");
const indexedFields = indexes.indexes.flatMap((index) => index.fields.map((field) => field.fieldPath));
for (const field of ["accountId", "integrityStatus", "category", "rulesetKey", "completedAt", "score"]) {
  assert.ok(indexedFields.includes(field), `Firestore indexes: missing ${field}`);
}

console.log(`Backend prototype checks passed: ${tables.length} SQL tables, ${indexes.indexes.length} Firestore indexes, no direct browser data access.`);
