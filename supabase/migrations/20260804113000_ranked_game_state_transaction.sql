-- Atomically persists the complete trusted state of one ranked game.
-- Browser roles cannot call this function; only the trusted service role can.

create or replace function public.persist_ranked_game_state(
  p_expected_revision bigint,
  p_game jsonb,
  p_rounds jsonb,
  p_guesses jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_game_id text := p_game->>'game_id';
  v_revision bigint;
begin
  if jsonb_typeof(p_game) <> 'object'
    or jsonb_typeof(p_rounds) <> 'array'
    or jsonb_typeof(p_guesses) <> 'array'
  then
    raise exception 'ranked_state_invalid';
  end if;

  if p_expected_revision is null then
    insert into public.ranked_games (
      game_id, create_request_id, guest_id_hash, account_id, status,
      integrity_status, integrity_reasons, ruleset_id, ruleset_version,
      scoring_version, category, round_duration_ms, planned_rounds,
      completed_rounds, score, total_response_time_ms, started_at,
      completed_at, claimed_at, expires_at, revision
    ) values (
      v_game_id,
      p_game->>'create_request_id',
      nullif(p_game->>'guest_id_hash', ''),
      nullif(p_game->>'account_id', ''),
      (p_game->>'status')::public.game_status,
      (p_game->>'integrity_status')::public.integrity_status,
      array(select jsonb_array_elements_text(p_game->'integrity_reasons')),
      p_game->>'ruleset_id',
      (p_game->>'ruleset_version')::integer,
      p_game->>'scoring_version',
      p_game->>'category',
      (p_game->>'round_duration_ms')::integer,
      (p_game->>'planned_rounds')::integer,
      (p_game->>'completed_rounds')::integer,
      (p_game->>'score')::integer,
      (p_game->>'total_response_time_ms')::bigint,
      (p_game->>'started_at')::timestamptz,
      nullif(p_game->>'completed_at', '')::timestamptz,
      nullif(p_game->>'claimed_at', '')::timestamptz,
      nullif(p_game->>'expires_at', '')::timestamptz,
      0
    );
    v_revision := 0;
  else
    update public.ranked_games
    set
      guest_id_hash = nullif(p_game->>'guest_id_hash', ''),
      account_id = nullif(p_game->>'account_id', ''),
      status = (p_game->>'status')::public.game_status,
      integrity_status = (p_game->>'integrity_status')::public.integrity_status,
      integrity_reasons = array(select jsonb_array_elements_text(p_game->'integrity_reasons')),
      completed_rounds = (p_game->>'completed_rounds')::integer,
      score = (p_game->>'score')::integer,
      total_response_time_ms = (p_game->>'total_response_time_ms')::bigint,
      completed_at = nullif(p_game->>'completed_at', '')::timestamptz,
      claimed_at = nullif(p_game->>'claimed_at', '')::timestamptz,
      expires_at = nullif(p_game->>'expires_at', '')::timestamptz,
      revision = revision + 1,
      updated_at = now()
    where game_id = v_game_id and revision = p_expected_revision
    returning revision into v_revision;

    if v_revision is null then
      raise exception 'ranked_revision_conflict';
    end if;

    delete from public.ranked_rounds where game_id = v_game_id;
  end if;

  insert into public.ranked_rounds (
    round_id, game_id, round_number, status, location_id,
    location_snapshot, started_at, deadline_at, resolved_at
  )
  select
    item->>'round_id',
    v_game_id,
    (item->>'round_number')::integer,
    item->>'status',
    item->>'location_id',
    item->'location_snapshot',
    nullif(item->>'started_at', '')::timestamptz,
    nullif(item->>'deadline_at', '')::timestamptz,
    nullif(item->>'resolved_at', '')::timestamptz
  from jsonb_array_elements(p_rounds) item;

  insert into public.ranked_guesses (
    guess_id, round_id, game_id, lat, lng, country_code, submitted_at,
    response_time_ms, distance_km, points, badge, country_correct,
    result_snapshot
  )
  select
    item->>'guess_id',
    item->>'round_id',
    v_game_id,
    (item->>'lat')::double precision,
    (item->>'lng')::double precision,
    nullif(item->>'country_code', ''),
    (item->>'submitted_at')::timestamptz,
    (item->>'response_time_ms')::integer,
    (item->>'distance_km')::double precision,
    (item->>'points')::integer,
    item->>'badge',
    (item->>'country_correct')::boolean,
    item->'result_snapshot'
  from jsonb_array_elements(p_guesses) item;

  return v_revision;
end;
$$;

revoke all on function public.persist_ranked_game_state(bigint, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.persist_ranked_game_state(bigint, jsonb, jsonb, jsonb) to service_role;
