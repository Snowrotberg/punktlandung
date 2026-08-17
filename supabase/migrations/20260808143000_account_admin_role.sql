-- Administrative access is an application-account property and is evaluated
-- only by trusted server code. Browser database roles keep no direct access.
create type public.account_role as enum ('player', 'admin');

alter table public.accounts
  add column role public.account_role not null default 'player';
