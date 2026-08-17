-- Automatic difficulty maintenance from server-verified ranked rounds only.
-- The table is deliberately not exposed to browser roles. The trusted server
-- or a Supabase scheduled job can call private.refresh_location_difficulty_metrics().

create table if not exists public.location_difficulty_metrics (
  location_id text primary key check (char_length(location_id) between 1 and 256),
  verified_rounds integer not null check (verified_rounds >= 0),
  average_points numeric(10, 2) not null check (average_points between 0 and 5000),
  success_rate numeric(7, 6) not null check (success_rate between 0 and 1),
  median_response_ratio numeric(7, 6) not null check (median_response_ratio between 0 and 1),
  suggested_difficulty text not null check (suggested_difficulty in ('easy', 'medium', 'hard')),
  confidence text not null check (confidence in ('insufficient', 'provisional', 'stable')),
  calculated_at timestamptz not null default now()
);

create index if not exists location_difficulty_metrics_difficulty_idx
  on public.location_difficulty_metrics (suggested_difficulty, verified_rounds desc);

alter table public.location_difficulty_metrics enable row level security;
revoke all on table public.location_difficulty_metrics from public, anon, authenticated;
grant select, insert, update, delete on table public.location_difficulty_metrics to service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create or replace function private.refresh_location_difficulty_metrics()
returns integer
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  refreshed_count integer;
begin
  with observations as (
    select
      round_row.location_id,
      guess_row.points,
      guess_row.response_time_ms,
      guess_row.country_correct,
      greatest(
        0::numeric,
        least(
          1::numeric,
          guess_row.response_time_ms::numeric / nullif(game_row.time_limit_sec * 1000, 0)
        )
      ) as response_ratio
    from public.ranked_rounds round_row
    join public.ranked_guesses guess_row
      on guess_row.round_id = round_row.round_id
     and guess_row.game_id = round_row.game_id
    join public.ranked_games game_row
      on game_row.game_id = round_row.game_id
    where game_row.status = 'completed'
      and game_row.integrity_status = 'verified'
      and game_row.account_id is not null
      and game_row.time_limit_sec in (15, 30, 60)
      and round_row.status = 'resolved'
  ), metrics as (
    select
      location_id,
      count(*)::integer as verified_rounds,
      round(avg(points)::numeric, 2) as average_points,
      round(avg(case when country_correct then 1 else 0 end)::numeric, 6) as success_rate,
      round(percentile_cont(0.5) within group (order by response_ratio)::numeric, 6)
        as median_response_ratio
    from observations
    group by location_id
  ), classified as (
    select
      location_id,
      verified_rounds,
      average_points,
      success_rate,
      median_response_ratio,
      case
        when verified_rounds < 30 then 'medium'
        when (
          0.55 * (1 - average_points / 5000)
          + 0.30 * (1 - success_rate)
          + 0.15 * median_response_ratio
        ) >= 0.62 then 'hard'
        when (
          0.55 * (1 - average_points / 5000)
          + 0.30 * (1 - success_rate)
          + 0.15 * median_response_ratio
        ) <= 0.34 then 'easy'
        else 'medium'
      end as suggested_difficulty,
      case
        when verified_rounds < 30 then 'insufficient'
        when verified_rounds >= 100 then 'stable'
        else 'provisional'
      end as confidence
    from metrics
  ), upserted as (
    insert into public.location_difficulty_metrics (
      location_id,
      verified_rounds,
      average_points,
      success_rate,
      median_response_ratio,
      suggested_difficulty,
      confidence,
      calculated_at
    )
    select
      location_id,
      verified_rounds,
      average_points,
      success_rate,
      median_response_ratio,
      suggested_difficulty,
      confidence,
      now()
    from classified
    on conflict (location_id) do update set
      verified_rounds = excluded.verified_rounds,
      average_points = excluded.average_points,
      success_rate = excluded.success_rate,
      median_response_ratio = excluded.median_response_ratio,
      suggested_difficulty = excluded.suggested_difficulty,
      confidence = excluded.confidence,
      calculated_at = excluded.calculated_at
    returning 1
  )
  select count(*)::integer into refreshed_count from upserted;

  return coalesce(refreshed_count, 0);
end;
$$;

revoke all on function private.refresh_location_difficulty_metrics() from public, anon, authenticated;
grant execute on function private.refresh_location_difficulty_metrics() to service_role;

-- If Supabase Cron is enabled, keep the metrics refreshed hourly. The dynamic
-- call keeps this migration valid on projects where pg_cron is not enabled;
-- the trusted server function remains callable manually in that case.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute $schedule$
        select cron.schedule(
          'location-difficulty-refresh',
          '15 * * * *',
          $command$select private.refresh_location_difficulty_metrics();$command$
        )
      $schedule$;
    exception
      when unique_violation then null;
    end;
  end if;
end;
$$;
