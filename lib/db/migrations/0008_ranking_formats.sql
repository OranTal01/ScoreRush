alter table public.scoring_rules
  add column ranking_config jsonb not null default '{"mode":"exact"}'::jsonb,
  add column ranking_locks_at timestamptz;
--> statement-breakpoint
create or replace function public.is_group_prediction_locked(p_tournament_id uuid, p_group text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(now() >= coalesce(
    (select ranking_locks_at from public.scoring_rules
     where tournament_id = p_tournament_id order by version desc limit 1),
    (select min(kickoff) from public.matches
     where tournament_id = p_tournament_id and "group" = p_group)
  ), true);
$$;
