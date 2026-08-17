-- Enable the scheduler that was optional in the original difficulty migration.
-- The named job is idempotent: scheduling it again updates the existing job.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'location-difficulty-refresh',
  '15 * * * *',
  $command$select private.refresh_location_difficulty_metrics();$command$
);

select private.refresh_location_difficulty_metrics();
