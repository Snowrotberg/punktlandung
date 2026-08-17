-- Cover foreign keys used by cleanup, moderation, ranking replacement and
-- round/guess integrity operations. Partial indexes remain small where null
-- means that no live relationship exists.

create index account_deletion_jobs_account_idx
  on public.account_deletion_jobs (account_id)
  where account_id is not null;

create index leaderboard_entries_account_idx
  on public.leaderboard_entries (account_id);

create index moderation_events_actor_idx
  on public.moderation_events (actor_id)
  where actor_id is not null;

create index ranked_guesses_round_game_idx
  on public.ranked_guesses (round_id, game_id);
