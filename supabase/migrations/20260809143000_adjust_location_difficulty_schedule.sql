-- Recalculate adaptive difficulty once per day and use launch-friendly
-- confidence thresholds: provisional from 15, stable from 50 verified rounds.
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
        when verified_rounds < 15 then 'medium'
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
        when verified_rounds < 15 then 'insufficient'
        when verified_rounds >= 50 then 'stable'
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

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'location-difficulty-refresh'),
  schedule := '15 3 * * *'
);

select private.refresh_location_difficulty_metrics();
