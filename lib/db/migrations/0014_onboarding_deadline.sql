alter table public.tournaments
  add column onboarding_closes_at timestamptz;
--> statement-breakpoint
create or replace function public.is_match_locked(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case
    when m.status in ('cancelled','postponed') then true
    when t.onboarding_open
      and (t.onboarding_closes_at is null or now() < t.onboarding_closes_at)
      and m.matchday <= t.onboarding_matchday
      and m.stage in ('group','group_stage','league_stage') then false
    else now() >= m.lock_time end
  from public.matches m join public.tournaments t on t.id=m.tournament_id
  where m.id=p_match_id), true);
$$;
--> statement-breakpoint
create or replace function public.is_bonus_category_locked(p_category_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select not (
      t.onboarding_open and (t.onboarding_closes_at is null or now() < t.onboarding_closes_at)
    ) and b.locks_at is not null and now() >= b.locks_at
    from public.bonus_categories b join public.tournaments t on t.id=b.tournament_id
    where b.id=p_category_id), true);
$$;
--> statement-breakpoint
create or replace function public.is_group_prediction_locked(p_tournament_id uuid, p_group text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case
    when t.onboarding_open and (t.onboarding_closes_at is null or now() < t.onboarding_closes_at) then false
    else coalesce(now() >= coalesce(
      (select ranking_locks_at from public.scoring_rules where tournament_id=t.id order by version desc limit 1),
      (select min(kickoff) from public.matches where tournament_id=t.id and "group"=p_group)
    ), true) end from public.tournaments t where t.id=p_tournament_id), true);
$$;
--> statement-breakpoint
create or replace function public.fill_missing_predictions(p_tournament_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  for v in
    select id, onboarding_closes_at from public.tournaments
    where onboarding_open and onboarding_closes_at is not null
      and onboarding_closes_at <= now()
      and (p_tournament_id is null or id=p_tournament_id)
    for update
  loop
    update public.tournaments set onboarding_open=false,
      onboarding_closed_at=v.onboarding_closes_at where id=v.id;
    update public.scoring_rules set ranking_locks_at=v.onboarding_closes_at
      where tournament_id=v.id;
    update public.bonus_categories set locks_at=v.onboarding_closes_at
      where tournament_id=v.id;
    insert into public.system_events(tournament_id,type,payload)
      values(v.id,'onboarding_closed',jsonb_build_object(
        'closed_by','automatic_deadline','closed_at',v.onboarding_closes_at));
  end loop;

  insert into public.match_predictions(match_id, participant_id, predicted_home, predicted_away, submitted_at, is_default)
  select m.id, p.id, 0, 0, now(), true from public.matches m
  join public.tournaments t on t.id=m.tournament_id
  join public.participants p on p.tournament_id=t.id
  where (p_tournament_id is null or t.id=p_tournament_id)
    and m.lock_time <= now() and m.status in ('scheduled','live','finished')
    and not (t.onboarding_open
      and (t.onboarding_closes_at is null or now() < t.onboarding_closes_at)
      and m.matchday <= t.onboarding_matchday
      and m.stage in ('group','group_stage','league_stage'))
    and (p.joined_at <= m.lock_time or (t.onboarding_closed_at is not null
      and p.joined_at <= t.onboarding_closed_at and m.matchday <= t.onboarding_matchday
      and m.stage in ('group','group_stage','league_stage')))
  on conflict (match_id, participant_id) do nothing;
end;
$$;
revoke all on function public.fill_missing_predictions(uuid) from public, anon, authenticated;
grant execute on function public.fill_missing_predictions(uuid) to service_role;
--> statement-breakpoint
create or replace function public.audit_retrospective_prediction()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_match public.matches%rowtype; v_tournament public.tournaments%rowtype;
begin
  if auth.uid() is null or (tg_op='INSERT' and new.is_default) then return new; end if;
  select * into v_match from public.matches where id=new.match_id;
  select * into v_tournament from public.tournaments where id=v_match.tournament_id for share;
  if v_match.lock_time <= now() and not (
    v_tournament.onboarding_open
    and (v_tournament.onboarding_closes_at is null or now() < v_tournament.onboarding_closes_at)
    and v_match.matchday <= v_tournament.onboarding_matchday
    and v_match.stage in ('group','group_stage','league_stage')
  ) then raise exception 'Prediction is locked'; end if;
  if tg_op='UPDATE' and v_match.lock_time <= now() and not old.is_default then
    raise exception 'Retrospective prediction already submitted';
  end if;
  new.is_default=false;
  if v_tournament.onboarding_open and v_match.lock_time <= now() then
    insert into public.system_events(tournament_id,type,payload)
      values(v_match.tournament_id,'retrospective_prediction',jsonb_build_object(
        'participant_id',new.participant_id,'match_id',new.match_id,
        'home',new.predicted_home,'away',new.predicted_away,'entered_at',now()));
  end if;
  if tg_op='UPDATE' and (new.predicted_home is distinct from old.predicted_home or new.predicted_away is distinct from old.predicted_away) then
    new.points_earned=null; new.outcome=null;
  end if;
  return new;
end;
$$;
