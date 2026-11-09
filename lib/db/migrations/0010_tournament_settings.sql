alter table public.tournaments
  add column settings_revision integer not null default 0 check (settings_revision >= 0),
  add column match_lock_minutes integer not null default 5 check (match_lock_minutes between 0 and 1440);
--> statement-breakpoint
create function public.bump_tournament_settings_revision()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.name is distinct from old.name
     or new.match_lock_minutes is distinct from old.match_lock_minutes
     or new.onboarding_open is distinct from old.onboarding_open
     or new.onboarding_matchday is distinct from old.onboarding_matchday
     or new.onboarding_closed_at is distinct from old.onboarding_closed_at
     or new.settings_revision is distinct from old.settings_revision then
    new.settings_revision := old.settings_revision + 1;
  end if;
  return new;
end;
$$;
create trigger tournaments_settings_revision before update on public.tournaments
for each row execute function public.bump_tournament_settings_revision();
--> statement-breakpoint
-- Keep provider imports consistent with the current tournament setting.
-- Match-specific manual deadlines remain intact when kickoff is rescheduled.
create function public.apply_tournament_match_deadline()
returns trigger language plpgsql set search_path = public as $$
declare minutes_before integer;
begin
  select match_lock_minutes into minutes_before from public.tournaments where id=new.tournament_id;
  if TG_OP='INSERT' then
    new.lock_time := new.kickoff - make_interval(mins => minutes_before);
  elsif new.kickoff is distinct from old.kickoff and new.lock_time = old.lock_time
    and (old.lock_time=old.kickoff or old.lock_time=old.kickoff-make_interval(mins => minutes_before)) then
    new.lock_time := new.kickoff - make_interval(mins => minutes_before);
  end if;
  return new;
end;
$$;
create trigger matches_tournament_deadline before insert or update of kickoff on public.matches
for each row execute function public.apply_tournament_match_deadline();
--> statement-breakpoint
-- Settings writes go through authenticated server actions so compatibility,
-- audit, scoring and concurrency checks cannot be skipped via the REST API.
revoke insert, update, delete on public.tournaments, public.scoring_rules,
  public.bonus_categories, public.bonus_slots, public.prizes, public.tournament_providers
  from authenticated, anon;
