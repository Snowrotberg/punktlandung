-- Atomic account identity resolution and optimistic profile revisions.

alter table public.profiles
  add column revision bigint not null default 0 check (revision >= 0);

create or replace function public.resolve_account_identity(
  p_auth_backend text,
  p_backend_user_id text,
  p_login_provider public.login_provider,
  p_provider_subject text,
  p_verified_at timestamptz,
  p_now timestamptz,
  p_new_account_id text,
  p_target_account_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_binding_lock bigint;
  v_identity_lock bigint;
  v_binding_account_id text;
  v_identity_account_id text;
  v_account_id text;
  v_account_created boolean := false;
  v_account public.accounts%rowtype;
  v_binding public.auth_bindings%rowtype;
  v_identity public.login_identities%rowtype;
begin
  if p_auth_backend not in ('supabase', 'firebase')
    or char_length(p_backend_user_id) not between 1 and 512
    or char_length(p_provider_subject) not between 1 and 512
    or p_verified_at > p_now + interval '1 minute'
    or p_new_account_id !~ '^[A-Za-z0-9_-]{8,128}$'
    or (p_target_account_id is not null and p_target_account_id !~ '^[A-Za-z0-9_-]{8,128}$') then
    raise exception using errcode = '22023', message = 'invalid_principal';
  end if;

  v_binding_lock := pg_catalog.hashtextextended('binding:' || p_auth_backend || ':' || p_backend_user_id, 0);
  v_identity_lock := pg_catalog.hashtextextended('identity:' || p_login_provider::text || ':' || p_provider_subject, 0);
  perform pg_catalog.pg_advisory_xact_lock(least(v_binding_lock, v_identity_lock));
  if v_binding_lock <> v_identity_lock then
    perform pg_catalog.pg_advisory_xact_lock(greatest(v_binding_lock, v_identity_lock));
  end if;

  select account_id into v_binding_account_id
  from public.auth_bindings
  where auth_backend = p_auth_backend and backend_user_id = p_backend_user_id;

  select account_id into v_identity_account_id
  from public.login_identities
  where provider = p_login_provider and provider_subject = p_provider_subject;

  if v_binding_account_id is not null and v_identity_account_id is not null
    and v_binding_account_id <> v_identity_account_id then
    raise exception using errcode = '23505', message = 'identity_conflict';
  end if;

  if p_target_account_id is not null then
    if (v_binding_account_id is not null and v_binding_account_id <> p_target_account_id)
      or (v_identity_account_id is not null and v_identity_account_id <> p_target_account_id) then
      raise exception using errcode = '23505', message = 'identity_conflict';
    end if;
    v_account_id := p_target_account_id;
  else
    v_account_id := coalesce(v_binding_account_id, v_identity_account_id, p_new_account_id);
  end if;

  select * into v_account
  from public.accounts
  where account_id = v_account_id
  for update;

  if not found then
    if p_target_account_id is not null or v_account_id <> p_new_account_id then
      raise exception using errcode = 'P0002', message = 'account_missing';
    end if;
    insert into public.accounts (account_id, status, created_at, updated_at)
    values (v_account_id, 'active', p_now, p_now)
    returning * into v_account;
    v_account_created := true;
  end if;

  if v_account.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'account_inactive';
  end if;

  insert into public.auth_bindings (
    auth_backend, backend_user_id, account_id, created_at, last_used_at
  ) values (
    p_auth_backend, p_backend_user_id, v_account_id, p_now, p_now
  )
  on conflict (auth_backend, backend_user_id) do update
    set last_used_at = excluded.last_used_at
    where public.auth_bindings.account_id = excluded.account_id
  returning * into v_binding;
  if not found then
    raise exception using errcode = '23505', message = 'identity_conflict';
  end if;

  insert into public.login_identities (
    account_id, provider, provider_subject, verified_at, last_used_at
  ) values (
    v_account_id, p_login_provider, p_provider_subject, p_verified_at, p_now
  )
  on conflict (provider, provider_subject) do update
    set last_used_at = excluded.last_used_at,
        verified_at = greatest(public.login_identities.verified_at, excluded.verified_at)
    where public.login_identities.account_id = excluded.account_id
  returning * into v_identity;
  if not found then
    raise exception using errcode = '23505', message = 'identity_conflict';
  end if;

  return pg_catalog.jsonb_build_object(
    'account', pg_catalog.to_jsonb(v_account),
    'binding', pg_catalog.to_jsonb(v_binding),
    'identity', pg_catalog.to_jsonb(v_identity),
    'account_created', v_account_created
  );
end;
$$;

revoke execute on function public.resolve_account_identity(
  text, text, public.login_provider, text, timestamptz, timestamptz, text, text
) from public, anon, authenticated;

grant execute on function public.resolve_account_identity(
  text, text, public.login_provider, text, timestamptz, timestamptz, text, text
) to service_role;
