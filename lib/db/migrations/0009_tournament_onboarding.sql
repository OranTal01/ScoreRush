alter table public.match_predictions add column is_default boolean not null default false;
--> statement-breakpoint
alter table public.tournaments
  add column onboarding_open boolean not null default false,
  add column onboarding_matchday integer not null default 1 check(onboarding_matchday > 0),
  add column onboarding_closed_at timestamptz;
--> statement-breakpoint
create or replace function public.is_match_locked(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case
    when m.status in ('cancelled','postponed') then true
    when t.onboarding_open and m.matchday <= t.onboarding_matchday
      and m.stage in ('group','group_stage','league_stage') then false
    else now() >= m.lock_time end
  from public.matches m join public.tournaments t on t.id=m.tournament_id
  where m.id=p_match_id), true);
$$;
--> statement-breakpoint
create or replace function public.is_bonus_category_locked(p_category_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select not t.onboarding_open and b.locks_at is not null and now() >= b.locks_at
    from public.bonus_categories b join public.tournaments t on t.id=b.tournament_id
    where b.id=p_category_id), true);
$$;
--> statement-breakpoint
create or replace function public.is_group_prediction_locked(p_tournament_id uuid, p_group text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when t.onboarding_open then false else
    coalesce(now() >= coalesce(
      (select ranking_locks_at from public.scoring_rules where tournament_id=t.id order by version desc limit 1),
      (select min(kickoff) from public.matches where tournament_id=t.id and "group"=p_group)
    ), true) end from public.tournaments t where t.id=p_tournament_id), true);
$$;
--> statement-breakpoint
-- One definition shared by the minute cron and the application sync.
create or replace function public.fill_missing_predictions(p_tournament_id uuid default null)
returns void language sql security definer set search_path = public as $$
  insert into public.match_predictions(match_id, participant_id, predicted_home, predicted_away, submitted_at, is_default)
  select m.id, p.id, 0, 0, now(), true from public.matches m
  join public.tournaments t on t.id=m.tournament_id
  join public.participants p on p.tournament_id=t.id
  where (p_tournament_id is null or t.id=p_tournament_id)
    and m.lock_time <= now() and m.status in ('scheduled','live','finished')
    and not (t.onboarding_open and m.matchday <= t.onboarding_matchday and m.stage in ('group','group_stage','league_stage'))
    and (p.joined_at <= m.lock_time or (t.onboarding_closed_at is not null
      and p.joined_at <= t.onboarding_closed_at and m.matchday <= t.onboarding_matchday
      and m.stage in ('group','group_stage','league_stage')))
  on conflict (match_id, participant_id) do nothing;
$$;
revoke all on function public.fill_missing_predictions(uuid) from public, anon, authenticated;
grant execute on function public.fill_missing_predictions(uuid) to service_role;
--> statement-breakpoint
create or replace function public.close_tournament_onboarding(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_tournament public.tournaments%rowtype;
begin
  if auth.uid() is null or not public.is_tournament_admin(auth.uid(),p_tournament_id) then
    raise exception 'Tournament administrator required';
  end if;
  select * into v_tournament from public.tournaments where id=p_tournament_id for update;
  if not found or not v_tournament.onboarding_open then raise exception 'Onboarding is already closed'; end if;
  update public.tournaments set onboarding_open=false, onboarding_closed_at=now(), status='active' where id=p_tournament_id;
  update public.scoring_rules set ranking_locks_at=now() where tournament_id=p_tournament_id;
  update public.bonus_categories set locks_at=now() where tournament_id=p_tournament_id;
  perform public.fill_missing_predictions(p_tournament_id);
  insert into public.system_events(tournament_id,type,payload) values(p_tournament_id,'onboarding_closed',jsonb_build_object('closed_by',auth.uid(),'closed_at',now()));
end;
$$;
revoke all on function public.close_tournament_onboarding(uuid) from public, anon;
grant execute on function public.close_tournament_onboarding(uuid) to authenticated;
--> statement-breakpoint
create or replace function public.audit_retrospective_prediction()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_match public.matches%rowtype; v_tournament public.tournaments%rowtype;
begin
  if auth.uid() is null or (tg_op='INSERT' and new.is_default) then return new; end if;
  select * into v_match from public.matches where id=new.match_id;
  select * into v_tournament from public.tournaments where id=v_match.tournament_id for share;
  if v_match.lock_time <= now() and not (v_tournament.onboarding_open and v_match.matchday <= v_tournament.onboarding_matchday and v_match.stage in ('group','group_stage','league_stage')) then
    raise exception 'Prediction is locked';
  end if;
  new.is_default=false;
  if v_tournament.onboarding_open and v_match.lock_time <= now() then
    insert into public.system_events(tournament_id,type,payload) values(v_match.tournament_id,'retrospective_prediction',
      jsonb_build_object('participant_id',new.participant_id,'match_id',new.match_id,'home',new.predicted_home,'away',new.predicted_away,'entered_at',now()));
  end if;
  -- A changed prediction cannot retain a score calculated for its old value.
  if tg_op='UPDATE' and (new.predicted_home is distinct from old.predicted_home or new.predicted_away is distinct from old.predicted_away) then
    new.points_earned=null; new.outcome=null;
  end if;
  return new;
end;
$$;
create trigger match_predictions_audit_retrospective before insert or update on public.match_predictions
for each row execute function public.audit_retrospective_prediction();
--> statement-breakpoint
create or replace function public.consume_invitation_with_nickname(p_token text, p_nickname text)
returns public.participants language plpgsql security definer set search_path = public as $$
declare v_participant public.participants%rowtype; v_nickname text;
begin
  v_nickname=nullif(trim(p_nickname),'');
  if v_nickname is not null and (char_length(v_nickname)>32 or v_nickname ~ '[[:cntrl:]]') then raise exception 'Invalid nickname'; end if;
  select * into v_participant from public.consume_invitation(p_token);
  if v_nickname is not null then
    if exists(select 1 from public.participants where tournament_id=v_participant.tournament_id and id<>v_participant.id and lower(display_name)=lower(v_nickname)) then
      raise exception 'Nickname already in use';
    end if;
    update public.participants set display_name=v_nickname where id=v_participant.id returning * into v_participant;
  end if;
  return v_participant;
end;
$$;
revoke all on function public.consume_invitation_with_nickname(text,text) from public, anon;
grant execute on function public.consume_invitation_with_nickname(text,text) to authenticated;

--> statement-breakpoint
-- Counts only; even administrators do not receive another member's picks during onboarding.
create or replace function public.onboarding_progress(p_tournament_id uuid)
returns table(participant_id uuid, display_name text, match_picks bigint, bonus_picks bigint, ranking_picks bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name,
    (select count(*) from public.match_predictions mp join public.matches m on m.id=mp.match_id
     where mp.participant_id=p.id and not mp.is_default and m.matchday <= t.onboarding_matchday and m.stage in ('group','group_stage','league_stage')),
    (select count(*) from public.bonus_predictions bp join public.bonus_categories bc on bc.id=bp.category_id where bp.participant_id=p.id and bc.tournament_id=t.id),
    (select count(*) from public.group_predictions gp where gp.participant_id=p.id and gp.tournament_id=t.id)
  from public.participants p join public.tournaments t on t.id=p.tournament_id
  where t.id=p_tournament_id and public.is_tournament_admin(auth.uid(),p_tournament_id)
  order by p.joined_at;
$$;
revoke all on function public.onboarding_progress(uuid) from public, anon;
grant execute on function public.onboarding_progress(uuid) to authenticated;
