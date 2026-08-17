-- Community feature voting and moderation. Browser roles intentionally have
-- no direct access; all reads and writes pass through trusted Next.js code.
create type public.community_suggestion_status as enum (
  'pending',
  'approved',
  'planned',
  'in_progress',
  'completed',
  'declined'
);

create table public.community_suggestions (
  suggestion_id text primary key check (suggestion_id ~ '^suggestion_[a-f0-9]{32}$'),
  author_account_id text references public.accounts(account_id) on delete cascade,
  guest_id_hash text check (guest_id_hash is null or guest_id_hash ~ '^[a-f0-9]{64}$'),
  author_label text not null check (char_length(author_label) between 1 and 40),
  title text not null check (char_length(title) between 8 and 100),
  details text not null check (char_length(details) between 20 and 2000),
  status public.community_suggestion_status not null default 'pending',
  moderation_note text check (moderation_note is null or char_length(moderation_note) <= 1000),
  moderated_by text references public.accounts(account_id) on delete set null,
  moderated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (author_account_id is not null and guest_id_hash is null)
    or
    (author_account_id is null and guest_id_hash is not null)
  ),
  check (
    (status in ('pending', 'declined') and published_at is null)
    or
    (status in ('approved', 'planned', 'in_progress', 'completed') and published_at is not null)
  )
);

create table public.community_votes (
  suggestion_id text not null references public.community_suggestions(suggestion_id) on delete cascade,
  account_id text not null references public.accounts(account_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (suggestion_id, account_id)
);

create index community_suggestions_status_created_idx
  on public.community_suggestions (status, created_at desc);
create index community_suggestions_author_created_idx
  on public.community_suggestions (author_account_id, created_at desc);
create index community_suggestions_guest_created_idx
  on public.community_suggestions (guest_id_hash, created_at desc)
  where guest_id_hash is not null;
create index community_votes_account_idx
  on public.community_votes (account_id, created_at desc);

alter table public.community_suggestions enable row level security;
alter table public.community_votes enable row level security;

revoke all on table public.community_suggestions from public, anon, authenticated;
revoke all on table public.community_votes from public, anon, authenticated;

grant select, insert, update, delete on table public.community_suggestions to service_role;
grant select, insert, update, delete on table public.community_votes to service_role;
