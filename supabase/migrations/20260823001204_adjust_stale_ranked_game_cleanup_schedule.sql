-- Stale guest games only need one maintenance pass per day. pg_cron uses UTC
-- for this project, so the cleanup runs daily at 03:37 UTC.
do $$
declare
  cleanup_job_count integer;
  cleanup_job_id bigint;
begin
  select count(*), min(jobid)
  into cleanup_job_count, cleanup_job_id
  from cron.job
  where jobname = 'stale-ranked-game-cleanup';

  if cleanup_job_count <> 1 then
    raise exception 'Expected exactly one stale-ranked-game-cleanup job, found %.', cleanup_job_count;
  end if;

  perform cron.alter_job(
    job_id := cleanup_job_id,
    schedule := '37 3 * * *'
  );
end;
$$;
