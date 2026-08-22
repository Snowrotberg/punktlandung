-- Ranked games are resumable from the browser for 24 hours. Remove abandoned
-- active games after that same window, while completed guest games keep their
-- separate application-managed claim deadline in expires_at.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.cleanup_stale_ranked_games(
  p_active_retention interval default interval '24 hours',
  p_batch_size integer default 500
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if p_active_retention < interval '1 hour' then
    raise exception 'Active ranked-game retention must be at least one hour.';
  end if;

  with victims as (
    select game_id
    from public.ranked_games
    where account_id is null
      and (
        (status = 'active' and updated_at <= now() - p_active_retention)
        or
        (status = 'completed' and expires_at <= now())
      )
    order by updated_at, game_id
    limit greatest(1, least(p_batch_size, 5000))
    for update skip locked
  )
  delete from public.ranked_games as games
  using victims
  where games.game_id = victims.game_id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function private.cleanup_stale_ranked_games(interval, integer) from public, anon, authenticated;
grant execute on function private.cleanup_stale_ranked_games(interval, integer) to service_role;

select cron.schedule(
  'stale-ranked-game-cleanup',
  '37 * * * *',
  $command$select private.cleanup_stale_ranked_games();$command$
);

-- Clear the current backlog as soon as the migration is deployed. Child rounds
-- and guesses are removed by their existing ON DELETE CASCADE constraints.
select private.cleanup_stale_ranked_games();
