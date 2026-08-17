-- Punktlandung provider evaluation: PostgreSQL/Supabase candidate schema.
-- This is a reviewable prototype, not a production migration.

create type public.account_status as enum ('active', 'restricted', 'deleted');
create type public.game_status as enum ('active', 'completed');
create type public.integrity_status as enum ('verified', 'flagged', 'invalid');
create type public.login_provider as enum ('email', 'google', 'apple');

-- App-owned identity. It deliberately does not use auth.users(id), so an Auth
-- provider migration does not change profiles, games or leaderboard ownership.
create table public.accounts (
  account_id uuid primary key,
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.auth_bindings (
  auth_backend text not null check (auth_backend in ('supabase', 'firebase')),
  backend_user_id text not null,
  account_id uuid not null references public.accounts(account_id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  primary key (auth_backend, backend_user_id)
);

create table public.login_identities (
  identity_id uuid primary key,
  account_id uuid not null references public.accounts(account_id) on delete cascade,
  provider public.login_provider not null,
  provider_subject text not null,
  verified_at timestamptz not null,
  last_used_at timestamptz not null,
  unique (provider, provider_subject)
);

create table public.profiles (
  account_id uuid primary key references public.accounts(account_id) on delete cascade,
  handle text not null,
  normalized_handle text not null unique,
  display_name text not null,
  avatar_key text,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (char_length(handle) between 3 and 24),
  check (char_length(display_name) between 1 and 40)
);

create table public.ranked_games (
  game_id uuid primary key,
  create_request_id uuid not null unique,
  guest_id_hash bytea,
  account_id uuid references public.accounts(account_id) on delete set null,
  status public.game_status not null,
  integrity_status public.integrity_status not null,
  integrity_reasons text[] not null default '{}',
  ruleset_id text not null,
  ruleset_version integer not null,
  scoring_version text not null,
  category text not null,
  round_duration_ms integer not null check (round_duration_ms >= 1000),
  planned_rounds integer not null check (planned_rounds between 1 and 25),
  completed_rounds integer not null default 0 check (completed_rounds >= 0),
  score integer not null default 0 check (score >= 0),
  total_response_time_ms bigint not null default 0 check (total_response_time_ms >= 0),
  started_at timestamptz not null,
  completed_at timestamptz,
  claimed_at timestamptz,
  expires_at timestamptz,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_rounds <= planned_rounds),
  check (
    (account_id is null and guest_id_hash is not null and expires_at is not null and claimed_at is null)
    or
    (account_id is not null and guest_id_hash is null and expires_at is null and claimed_at is not null)
  ),
  check (account_id is null or status = 'completed'),
  check (score <= planned_rounds * 5000),
  check ((status = 'completed') = (completed_at is not null))
);

create table public.ranked_rounds (
  round_id uuid primary key,
  game_id uuid not null references public.ranked_games(game_id) on delete cascade,
  round_number integer not null check (round_number > 0),
  status text not null check (status in ('pending', 'open', 'resolved')),
  location_id text not null,
  location_snapshot jsonb not null,
  started_at timestamptz,
  deadline_at timestamptz,
  resolved_at timestamptz,
  unique (game_id, round_number),
  unique (round_id, game_id),
  check (
    (status = 'pending' and started_at is null and deadline_at is null and resolved_at is null)
    or
    (status = 'open' and started_at is not null and deadline_at is not null and resolved_at is null)
    or
    (status = 'resolved' and started_at is not null and deadline_at is not null and resolved_at is not null)
  )
);

create table public.ranked_guesses (
  guess_id uuid primary key,
  round_id uuid not null unique,
  game_id uuid not null,
  lat double precision not null check (lat between -85 and 85),
  lng double precision not null check (lng between -180 and 180),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  submitted_at timestamptz not null,
  response_time_ms integer not null check (response_time_ms >= 0),
  distance_km double precision not null check (distance_km >= 0),
  points integer not null check (points between 0 and 5000),
  badge text not null,
  country_correct boolean not null,
  result_snapshot jsonb not null,
  foreign key (round_id, game_id)
    references public.ranked_rounds(round_id, game_id) on delete cascade
);

create table public.moderation_events (
  event_id uuid primary key,
  target_type text not null check (target_type in ('account', 'profile', 'game', 'leaderboard')),
  target_id text not null,
  action text not null check (action in ('restrict', 'invalidate_score', 'restore_score', 'rename', 'delete')),
  reason_code text not null,
  internal_note text,
  actor_id uuid references public.accounts(account_id) on delete set null,
  projection_status text not null default 'pending' check (projection_status in ('pending', 'completed')),
  projection_completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((projection_status = 'completed') = (projection_completed_at is not null))
);

create unique index moderation_events_game_invalidation_idx
  on public.moderation_events (event_id, target_id)
  where action = 'invalidate_score';

create table public.account_deletion_jobs (
  deletion_request_id uuid primary key,
  account_id uuid references public.accounts(account_id) on delete set null,
  status text not null check (status in ('queued', 'processing', 'completed', 'failed')),
  requested_at timestamptz not null,
  completed_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null)),
  check ((status = 'processing') = (lease_until is not null))
);

create table public.leaderboard_entries (
  scope_key text not null,
  account_id uuid not null references public.profiles(account_id) on delete cascade,
  handle text not null,
  rank integer not null check (rank > 0),
  score bigint not null check (score >= 0),
  games_count integer not null check (games_count > 0),
  best_score integer not null check (best_score >= 0),
  total_response_time_ms bigint not null check (total_response_time_ms >= 0),
  latest_completed_at timestamptz not null,
  calculated_at timestamptz not null default now(),
  primary key (scope_key, account_id)
);

create index ranked_games_account_completed_idx
  on public.ranked_games (account_id, completed_at desc)
  where status = 'completed';

create index auth_bindings_account_idx
  on public.auth_bindings (account_id);

create index login_identities_account_idx
  on public.login_identities (account_id);

create index ranked_games_leaderboard_idx
  on public.ranked_games (category, ruleset_id, ruleset_version, scoring_version, completed_at, score desc)
  where status = 'completed' and integrity_status = 'verified' and account_id is not null;

create index ranked_games_guest_expiry_idx
  on public.ranked_games (expires_at)
  where account_id is null;

create index account_deletion_jobs_worker_idx
  on public.account_deletion_jobs (status, requested_at, lease_until)
  where status in ('queued', 'processing', 'failed');

alter table public.accounts enable row level security;
alter table public.auth_bindings enable row level security;
alter table public.login_identities enable row level security;
alter table public.profiles enable row level security;
alter table public.ranked_games enable row level security;
alter table public.ranked_rounds enable row level security;
alter table public.ranked_guesses enable row level security;
alter table public.moderation_events enable row level security;
alter table public.account_deletion_jobs enable row level security;
alter table public.leaderboard_entries enable row level security;

-- Browsers never access application tables directly. Authentication may use
-- Supabase Auth, while the provider-neutral Next.js API performs all redaction,
-- ownership checks and authoritative writes with its private server role.
revoke all on public.accounts from anon, authenticated;
revoke all on public.auth_bindings from anon, authenticated;
revoke all on public.login_identities from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.ranked_games from anon, authenticated;
revoke all on public.ranked_rounds from anon, authenticated;
revoke all on public.ranked_guesses from anon, authenticated;
revoke all on public.moderation_events from anon, authenticated;
revoke all on public.account_deletion_jobs from anon, authenticated;
revoke all on public.leaderboard_entries from anon, authenticated;

-- Internal source for a trusted leaderboard rebuild. Browser roles have no
-- table privileges; the server returns only PublicLeaderboardEntry fields.
create view public.verified_ranked_results
with (security_invoker = true)
as
select
  game.game_id,
  game.account_id,
  profile.handle,
  game.category,
  game.ruleset_id,
  game.ruleset_version,
  game.scoring_version,
  game.score,
  game.total_response_time_ms,
  game.completed_at
from public.ranked_games game
join public.accounts account on account.account_id = game.account_id
join public.profiles profile on profile.account_id = game.account_id
where game.status = 'completed'
  and game.integrity_status = 'verified'
  and account.status = 'active'
  and profile.status = 'active'
  and profile.visibility = 'public';
