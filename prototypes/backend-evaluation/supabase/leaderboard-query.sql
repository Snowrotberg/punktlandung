-- Parameters:
--   :period_start, :period_end, :category, :ruleset_id,
--   :ruleset_version, :scoring_version, :game_limit

with eligible as (
  select
    result.*,
    row_number() over (
      partition by result.account_id
      order by result.score desc, result.total_response_time_ms asc, result.completed_at asc, result.game_id asc
    ) as game_rank
  from public.verified_ranked_results result
  where result.completed_at >= :period_start
    and result.completed_at < :period_end
    and result.category = :category
    and result.ruleset_id = :ruleset_id
    and result.ruleset_version = :ruleset_version
    and result.scoring_version = :scoring_version
), aggregated as (
  select
    account_id,
    min(handle) as handle,
    sum(score) as score,
    count(*) as games_count,
    max(score) as best_score,
    sum(total_response_time_ms) as total_response_time_ms,
    max(completed_at) as latest_completed_at
  from eligible
  where game_rank <= :game_limit
  group by account_id
)
select
  rank() over (
    order by score desc, total_response_time_ms asc, latest_completed_at asc
  ) as rank,
  *
from aggregated
order by rank, account_id;
