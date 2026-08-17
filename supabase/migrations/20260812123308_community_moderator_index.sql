create index community_suggestions_moderated_by_idx
  on public.community_suggestions (moderated_by)
  where moderated_by is not null;
