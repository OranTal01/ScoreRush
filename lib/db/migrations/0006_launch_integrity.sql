-- Participant-editable columns only; RLS alone does not protect columns.
revoke update on public.users from authenticated;
revoke update (is_platform_admin, id, email, created_at) on public.users from authenticated;
grant update (display_name, avatar_url) on public.users to authenticated;
--> statement-breakpoint
create or replace function public.guard_participant_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and (new.user_id is distinct from old.user_id or new.tournament_id is distinct from old.tournament_id or new.id is distinct from old.id or new.joined_at is distinct from old.joined_at) then
    raise exception 'Tournament membership identity cannot be changed';
  end if;
  return new;
end;
$$;
create trigger participants_guard_identity before update on public.participants
for each row execute function public.guard_participant_identity();
--> statement-breakpoint
create or replace function public.is_group_prediction_locked(p_tournament_id uuid, p_group text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(now() >= min(kickoff), true) from public.matches
  where tournament_id = p_tournament_id and "group" = p_group;
$$;
drop policy "group_predictions_write_own_before_finalized" on public.group_predictions;
create policy "group_predictions_write_own_before_start" on public.group_predictions
for all to authenticated
using (participant_id in (select id from public.participants where user_id = auth.uid() and tournament_id = group_predictions.tournament_id)
 and not public.is_group_prediction_locked(tournament_id, "group"))
with check (participant_id in (select id from public.participants where user_id = auth.uid() and tournament_id = group_predictions.tournament_id)
 and not public.is_group_prediction_locked(tournament_id, "group"));
--> statement-breakpoint
-- Scores are written exclusively by the backend. Upserts may only touch pick columns.
revoke insert, update on public.match_predictions, public.group_predictions, public.bonus_predictions from authenticated;
grant insert (match_id, participant_id, predicted_home, predicted_away, submitted_at, edited_at),
 update (match_id, participant_id, predicted_home, predicted_away, submitted_at, edited_at) on public.match_predictions to authenticated;
grant insert (tournament_id, participant_id, "group", predicted_order, submitted_at),
 update (tournament_id, participant_id, "group", predicted_order, submitted_at) on public.group_predictions to authenticated;
grant insert (category_id, slot_id, participant_id, pick_label, pick_ref_id, submitted_at),
 update (category_id, slot_id, participant_id, pick_label, pick_ref_id, submitted_at) on public.bonus_predictions to authenticated;
--> statement-breakpoint
create or replace function public.guard_prediction_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tournament uuid; v_member_tournament uuid;
begin
 select tournament_id into v_member_tournament from public.participants where id=new.participant_id;
 if TG_TABLE_NAME='match_predictions' then
   select tournament_id into v_tournament from public.matches where id=new.match_id;
   if new.predicted_home < 0 or new.predicted_away < 0 then raise exception 'Invalid score'; end if;
 elsif TG_TABLE_NAME='group_predictions' then
   v_tournament := new.tournament_id;
   if jsonb_typeof(new.predicted_order) <> 'array' then raise exception 'Invalid ranking'; end if;
   if (select count(*) from jsonb_array_elements_text(new.predicted_order)) <> (select count(*) from public.teams where tournament_id=v_tournament and "group"=new."group")
      or (select count(distinct value) from jsonb_array_elements_text(new.predicted_order)) <> jsonb_array_length(new.predicted_order)
      or exists(select 1 from jsonb_array_elements_text(new.predicted_order) p where not exists(select 1 from public.teams t where t.id::text=p.value and t.tournament_id=v_tournament and t."group"=new."group")) then
     raise exception 'Ranking must contain every team exactly once';
   end if;
 else
   select tournament_id into v_tournament from public.bonus_categories where id=new.category_id;
   if not exists(select 1 from public.bonus_slots where id=new.slot_id and category_id=new.category_id) then raise exception 'Invalid bonus slot'; end if;
 end if;
 if v_tournament is null or v_tournament is distinct from v_member_tournament then raise exception 'Prediction belongs to another tournament'; end if;
 return new;
end;
$$;
create trigger match_prediction_integrity before insert or update on public.match_predictions for each row execute function public.guard_prediction_integrity();
create trigger group_prediction_integrity before insert or update on public.group_predictions for each row execute function public.guard_prediction_integrity();
create trigger bonus_prediction_integrity before insert or update on public.bonus_predictions for each row execute function public.guard_prediction_integrity();
