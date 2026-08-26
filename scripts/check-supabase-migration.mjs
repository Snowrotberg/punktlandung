import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../supabase/migrations/20260803131746_account_ranking_foundation.sql",
  import.meta.url
);
const sql = await readFile(migrationUrl, "utf8");
const difficultyMigration = await readFile(
  new URL("../supabase/migrations/20260806130000_location_difficulty_maintenance.sql", import.meta.url),
  "utf8"
);
const difficultyThresholdMigration = await readFile(
  new URL("../supabase/migrations/20260826072430_lower_location_difficulty_thresholds.sql", import.meta.url),
  "utf8"
);
const communityMigration = await readFile(
  new URL("../supabase/migrations/20260812113846_community_roadmap.sql", import.meta.url),
  "utf8"
);
const communityIndexMigration = await readFile(
  new URL("../supabase/migrations/20260812123308_community_moderator_index.sql", import.meta.url),
  "utf8"
);

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
  assert.match(sql, new RegExp(`create table public\\.${table}\\s*\\(`, "i"), `${table} table is missing`);
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} must enable RLS`);
  assert.match(
    sql,
    new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i"),
    `${table} must deny browser roles`
  );
  assert.match(
    sql,
    new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role`, "i"),
    `${table} must explicitly grant the trusted server role`
  );
}

assert.doesNotMatch(sql, /create\s+policy/i, "Application tables must not gain direct browser policies");
assert.doesNotMatch(sql, /references\s+auth\.users/i, "Application ownership must stay provider-neutral");
assert.doesNotMatch(sql, /service_role[^;]*(?:NEXT_PUBLIC|browser|client)/i, "Secret role must stay server-only");
assert.match(sql, /account_id text primary key/i, "Application IDs must match the text-based domain model");
assert.match(sql, /primary key \(auth_backend, backend_user_id\)/i, "Auth bindings must be unique");
assert.match(sql, /primary key \(provider, provider_subject\)/i, "Provider identities must be unique");
assert.match(sql, /foreign key \(round_id, game_id\)/i, "Guesses must belong to their game round");
assert.match(sql, /game\.integrity_status = 'verified'/i, "Leaderboard source must include only verified games");
assert.match(sql, /profile\.visibility = 'public'/i, "Leaderboard source must respect private profiles");
assert.match(sql, /with \(security_invoker = true\)/i, "Leaderboard view must use invoker security");

assert.match(difficultyMigration, /create table if not exists public\.location_difficulty_metrics/i);
assert.match(difficultyMigration, /alter table public\.location_difficulty_metrics enable row level security/i);
assert.match(difficultyMigration, /revoke all on table public\.location_difficulty_metrics from public, anon, authenticated/i);
assert.match(difficultyMigration, /create or replace function private\.refresh_location_difficulty_metrics/i);
assert.match(difficultyMigration, /game_row\.time_limit_sec \* 1000/i, "Difficulty response times must be normalized by the selected time limit");
assert.match(difficultyMigration, /cron\.schedule/i, "Difficulty maintenance must be schedulable when pg_cron is enabled");
assert.match(difficultyThresholdMigration, /when verified_rounds < 10 then 'insufficient'/i, "Difficulty must become provisional at 10 verified rounds");
assert.match(difficultyThresholdMigration, /when verified_rounds >= 25 then 'stable'/i, "Difficulty must become stable at 25 verified rounds");
assert.match(difficultyThresholdMigration, /location_snapshot->>'category'/i, "Mixed games must classify each round by its actual location category");
assert.match(difficultyThresholdMigration, /when category = 'flags' then case when country_correct then 1 else 0 end/i, "Flag difficulty must use exact country correctness");
assert.match(difficultyThresholdMigration, /when distance_km < 750 then 1/i, "Map-motif difficulty must use the existing 750 km solved threshold");
assert.match(difficultyThresholdMigration, /select private\.refresh_location_difficulty_metrics\(\)/i, "Existing metrics must be recalculated after lowering thresholds");
assert.doesNotMatch(difficultyThresholdMigration, /(?:insert|update)\s+(?:into\s+)?cron\.job/i, "Cron jobs must only be managed through pg_cron functions");

for (const table of ["community_suggestions", "community_votes"]) {
  assert.match(communityMigration, new RegExp(`create table public\\.${table}\\s*\\(`, "i"));
  assert.match(communityMigration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(communityMigration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i"));
  assert.match(communityMigration, new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role`, "i"));
}
assert.doesNotMatch(communityMigration, /create\s+policy/i, "Community tables must stay behind trusted server code");
assert.match(communityMigration, /primary key \(suggestion_id, account_id\)/i, "Each account can vote once per suggestion");
assert.match(communityMigration, /guest_id_hash text check/i, "Guest suggestions must use a one-way guest identifier");
assert.match(communityMigration, /author_account_id is null and guest_id_hash is not null/i, "Every suggestion must have exactly one author authority");
assert.match(communityIndexMigration, /community_suggestions\s*\(moderated_by\)/i, "Community moderator foreign key must be indexed");

console.log(`Supabase migration checks passed: ${tables.length + 2} isolated application tables plus difficulty maintenance.`);
