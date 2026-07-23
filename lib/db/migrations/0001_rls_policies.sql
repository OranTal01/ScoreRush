-- Hand-authored migration (not drizzle-kit generated). RLS policy authoring
-- needs conditional logic, SECURITY DEFINER helper functions, and a trigger
-- that drizzle-kit's schema diffing doesn't model — see DATABASE.md §5 for
-- the policy table this file implements, and ARCHITECTURE.md §3/§13 for why
-- enforcement must live in Postgres, not just application code.

-- =============================================================================
-- 1. Helper functions (SECURITY DEFINER to avoid RLS self-recursion — a
--    policy on `participants` that queried `participants` directly would
--    recursively re-trigger RLS; SECURITY DEFINER functions run with the
--    privileges of their owner and bypass RLS on the tables they read).
-- =============================================================================

create or replace function public.is_platform_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from public.users where id = p_user_id),
    false
  );
$$;

create or replace function public.is_tournament_member(p_user_id uuid, p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.participants
    where tournament_id = p_tournament_id and user_id = p_user_id
  );
$$;

create or replace function public.is_tournament_admin(p_user_id uuid, p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin(p_user_id)
    or exists (
      select 1 from public.participants
      where tournament_id = p_tournament_id
        and user_id = p_user_id
        and role = 'tournament_admin'
    );
$$;

-- The genuinely time-dependent check at the heart of DATABASE.md §5's
-- "hidden until lock, no admin bypass" rule. Applies identically to
-- match_predictions (via matches.lock_time), group_predictions (via
-- `finalized` — SCORING-RULES.md §5 already treats "group stage complete"
-- as the meaningful boundary, a stricter/safer proxy than stage-start), and
-- bonus_predictions (via bonus_categories.locks_at). Explicit boundary-case
-- test coverage for match_predictions is required by DATABASE.md §5.
create or replace function public.is_match_locked(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select now() >= lock_time from public.matches where id = p_match_id;
$$;

create or replace function public.is_bonus_category_locked(p_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select locks_at is not null and now() >= locks_at
  from public.bonus_categories
  where id = p_category_id;
$$;

-- =============================================================================
-- 2. auth.users -> public.users provisioning trigger.
--    ARCHITECTURE.md §4: "Account creation (identity) is separate from
--    tournament membership (authorization)." This trigger handles the first
--    half automatically for both Google OAuth and magic-link sign-in; the
--    second half (joining a tournament) is a controlled RPC, not a trigger
--    — see consume_invitation() below.
-- =============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- =============================================================================
-- 3. Invitation consumption RPC.
--    DATABASE.md §5, invitations row: "consumption is a controlled
--    server-side flow, not direct table write." Implemented as a single
--    SECURITY DEFINER transaction with row locking (`for update`) so two
--    concurrent redemptions of the same single-use token can't both
--    succeed — a plain RLS insert policy can't express that atomicity.
--    Called from a Next.js Server Action via supabase.rpc('consume_invitation', ...)
--    using the *user's own* session (so auth.uid() below is the joining user).
-- =============================================================================

create or replace function public.consume_invitation(p_token text)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations%rowtype;
  v_user public.users%rowtype;
  v_participant public.participants%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to consume an invitation';
  end if;

  select * into v_invitation
  from public.invitations
  where token = p_token
  for update;

  if not found then
    raise exception 'Invalid invitation token';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'Invitation is % (not pending)', v_invitation.status;
  end if;

  if v_invitation.expires_at is not null and v_invitation.expires_at <= now() then
    update public.invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'Invitation has expired';
  end if;

  select * into v_user from public.users where id = auth.uid();

  if v_invitation.bound_email is not null and v_invitation.bound_email <> v_user.email then
    raise exception 'This invitation is bound to a different email address';
  end if;

  if exists (
    select 1 from public.participants
    where tournament_id = v_invitation.tournament_id and user_id = auth.uid()
  ) then
    raise exception 'Already a participant in this tournament';
  end if;

  insert into public.participants (tournament_id, user_id, role, display_name)
  values (
    v_invitation.tournament_id,
    auth.uid(),
    'participant',
    coalesce(v_user.display_name, split_part(v_user.email, '@', 1))
  )
  returning * into v_participant;

  update public.invitations
  set status = 'consumed', consumed_by = auth.uid(), consumed_at = now()
  where id = v_invitation.id;

  insert into public.system_events (tournament_id, type, payload)
  values (
    v_invitation.tournament_id,
    'invitation_consumed',
    jsonb_build_object('invitation_id', v_invitation.id, 'user_id', auth.uid())
  );

  return v_participant;
end;
$$;

-- =============================================================================
-- 4. Role-escalation guard.
--    Backstop enforced regardless of which RLS policy allowed an UPDATE on
--    participants: a self-service profile edit can never also change role.
-- =============================================================================

create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and not public.is_tournament_admin(auth.uid(), old.tournament_id) then
    raise exception 'Only a tournament admin can change a participant''s role';
  end if;
  return new;
end;
$$;

drop trigger if exists participants_prevent_self_role_escalation on public.participants;
create trigger participants_prevent_self_role_escalation
  before update on public.participants
  for each row execute function public.prevent_self_role_escalation();

-- =============================================================================
-- 5. Enable RLS on every table (ARCHITECTURE.md §13: "RLS-enforced tenant
--    isolation, not just app-layer checks").
-- =============================================================================

alter table public.users enable row level security;
alter table public.tournaments enable row level security;
alter table public.participants enable row level security;
alter table public.invitations enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.bonus_categories enable row level security;
alter table public.bonus_slots enable row level security;
alter table public.prizes enable row level security;
alter table public.tournament_providers enable row level security;
alter table public.match_predictions enable row level security;
alter table public.group_predictions enable row level security;
alter table public.bonus_predictions enable row level security;
alter table public.bonus_stats enable row level security;
alter table public.leaderboard_snapshots enable row level security;
alter table public.score_audit_logs enable row level security;
alter table public.admin_overrides enable row level security;
alter table public.sync_logs enable row level security;
alter table public.system_events enable row level security;
alter table public.notifications enable row level security;

-- =============================================================================
-- 6. Policies. Table family grouping/comments mirror DATABASE.md §5 exactly.
-- =============================================================================

-- ---- users (own profile): read self only, write self only ----

create policy "users_select_self" on public.users
  for select to authenticated
  using (id = auth.uid());

create policy "users_update_self" on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---- tournaments: read members, write tournament_admin/platform_admin ----

create policy "tournaments_select_members" on public.tournaments
  for select to authenticated
  using (public.is_tournament_member(auth.uid(), id) or created_by = auth.uid());

-- MVP: only the platform owner creates tournaments (DECISIONS.md).
create policy "tournaments_insert_platform_admin" on public.tournaments
  for insert to authenticated
  with check (public.is_platform_admin(auth.uid()));

create policy "tournaments_update_admin" on public.tournaments
  for update to authenticated
  using (public.is_tournament_admin(auth.uid(), id))
  with check (public.is_tournament_admin(auth.uid(), id));

-- ---- participants: read members, write self (join/profile edit) or admin (role/removal) ----

create policy "participants_select_members" on public.participants
  for select to authenticated
  using (public.is_tournament_member(auth.uid(), tournament_id));

-- Self-service join is NOT a direct insert policy — it goes through
-- consume_invitation() (SECURITY DEFINER, bypasses RLS) so token
-- single-use/expiry/email-binding is enforced atomically. This policy only
-- covers an admin directly adding someone (e.g. seeding a tournament).
create policy "participants_insert_admin" on public.participants
  for insert to authenticated
  with check (public.is_tournament_admin(auth.uid(), tournament_id));

create policy "participants_update_self_or_admin" on public.participants
  for update to authenticated
  using (user_id = auth.uid() or public.is_tournament_admin(auth.uid(), tournament_id))
  with check (user_id = auth.uid() or public.is_tournament_admin(auth.uid(), tournament_id));

create policy "participants_delete_admin" on public.participants
  for delete to authenticated
  using (public.is_tournament_admin(auth.uid(), tournament_id));

-- ---- invitations: admin manages; consumption goes through consume_invitation() ----

create policy "invitations_select_admin" on public.invitations
  for select to authenticated
  using (public.is_tournament_admin(auth.uid(), tournament_id));

create policy "invitations_insert_admin" on public.invitations
  for insert to authenticated
  with check (public.is_tournament_admin(auth.uid(), tournament_id) and created_by = auth.uid());

create policy "invitations_update_admin" on public.invitations
  for update to authenticated
  using (public.is_tournament_admin(auth.uid(), tournament_id))
  with check (public.is_tournament_admin(auth.uid(), tournament_id));

-- ---- matches, teams: read members, write admin only (sync job uses service role, which bypasses RLS) ----

create policy "teams_select_members" on public.teams
  for select to authenticated
  using (public.is_tournament_member(auth.uid(), tournament_id));

create policy "teams_write_admin" on public.teams
  for all to authenticated
  using (public.is_tournament_admin(auth.uid(), tournament_id))
  with check (public.is_tournament_admin(auth.uid(), tournament_id));

create policy "matches_select_members" on public.matches
  for select to authenticated
  using (public.is_tournament_member(auth.uid(), tournament_id));

create policy "matches_write_admin" on public.matches
  for all to authenticated
  using (public.is_tournament_admin(auth.uid(), tournament_id))
  with check (public.is_tournament_admin(auth.uid(), tournament_id));

-- ---- match_predictions, group_predictions, bonus_predictions: own always; ----
-- ---- others' only after lock (no admin bypass) ----

create policy "match_predictions_select_own_or_after_lock" on public.match_predictions
  for select to authenticated
  using (
    participant_id in (
      select id from public.participants
      where user_id = auth.uid() and tournament_id = (
        select tournament_id from public.matches where id = match_predictions.match_id
      )
    )
    or (
      public.is_match_locked(match_id)
      and public.is_tournament_member(
        auth.uid(),
        (select tournament_id from public.matches where id = match_predictions.match_id)
      )
    )
  );

create policy "match_predictions_write_own_before_lock" on public.match_predictions
  for all to authenticated
  using (
    participant_id in (select id from public.participants where user_id = auth.uid())
    and not public.is_match_locked(match_id)
  )
  with check (
    participant_id in (select id from public.participants where user_id = auth.uid())
    and not public.is_match_locked(match_id)
  );

create policy "group_predictions_select_own_or_finalized" on public.group_predictions
  for select to authenticated
  using (
    participant_id in (select id from public.participants where user_id = auth.uid())
    or (finalized and public.is_tournament_member(auth.uid(), tournament_id))
  );

create policy "group_predictions_write_own_before_finalized" on public.group_predictions
  for all to authenticated
  using (
    participant_id in (select id from public.participants where user_id = auth.uid())
    and not finalized
  )
  with check (
    participant_id in (select id from public.participants where user_id = auth.uid())
    and not finalized
  );

create policy "bonus_predictions_select_own_or_after_lock" on public.bonus_predictions
  for select to authenticated
  using (
    participant_id in (select id from public.participants where user_id = auth.uid())
    or (
      public.is_bonus_category_locked(category_id)
      and public.is_tournament_member(
        auth.uid(),
        (select tournament_id from public.bonus_categories where id = bonus_predictions.category_id)
      )
    )
  );

create policy "bonus_predictions_write_own_before_lock" on public.bonus_predictions
  for all to authenticated
  using (
    participant_id in (select id from public.participants where user_id = auth.uid())
    and not public.is_bonus_category_locked(category_id)
  )
  with check (
    participant_id in (select id from public.participants where user_id = auth.uid())
    and not public.is_bonus_category_locked(category_id)
  );

-- ---- scoring_rules, bonus_categories, bonus_slots, prizes, tournament_providers: ----
-- ---- read members, write admin only ----

create policy "scoring_rules_select_members" on public.scoring_rules
  for select to authenticated
  using (public.is_tournament_member(auth.uid(), tournament_id));

create policy "scoring_rules_write_admin" on public.scoring_rules
  for all to authenticated
  using (public.is_tournament_admin(auth.uid(), tournament_id))
  with check (public.is_tournament_admin(auth.uid(), tournament_id));

create policy "bonus_categories_select_members" on public.bonus_categories
  for select to authenticated
  using (public.is_tournament_member(auth.uid(), tournament_id));

create policy "bonus_categories_write_admin" on public.bonus_categories
  for all to authenticated
  using (public.is_tournament_admin(auth.uid(), tournament_id))
  with check (public.is_tournament_admin(auth.uid(), tournament_id));

create policy "bonus_slots_select_members" on public.bonus_slots
  for select to authenticated
  using (
    public.is_tournament_member(
      auth.uid(),
      (select tournament_id from public.bonus_categories where id = bonus_slots.category_id)
    )
  );

create policy "bonus_slots_write_admin" on public.bonus_slots
  for all to authenticated
  using (
    public.is_tournament_admin(
      auth.uid(),
      (select tournament_id from public.bonus_categories where id = bonus_slots.category_id)
    )
  )
  with check (
    public.is_tournament_admin(
      auth.uid(),
      (select tournament_id from public.bonus_categories where id = bonus_slots.category_id)
    )
  );

create policy "prizes_select_members" on public.prizes
  for select to authenticated
  using (public.is_tournament_member(auth.uid(), tournament_id));

create policy "prizes_write_admin" on public.prizes
  for all to authenticated
  using (public.is_tournament_admin(auth.uid(), tournament_id))
  with check (public.is_tournament_admin(auth.uid(), tournament_id));

create policy "tournament_providers_select_members" on public.tournament_providers
  for select to authenticated
  using (public.is_tournament_member(auth.uid(), tournament_id));

create policy "tournament_providers_write_admin" on public.tournament_providers
  for all to authenticated
  using (public.is_tournament_admin(auth.uid(), tournament_id))
  with check (public.is_tournament_admin(auth.uid(), tournament_id));

-- ---- bonus_stats, leaderboard_snapshots: read members (derived/public-ish within tournament) ----
-- Written only by the service role (sync/aggregation jobs), which bypasses RLS entirely.

create policy "bonus_stats_select_members" on public.bonus_stats
  for select to authenticated
  using (
    public.is_tournament_member(
      auth.uid(),
      (select tournament_id from public.bonus_categories where id = bonus_stats.category_id)
    )
  );

create policy "leaderboard_snapshots_select_members" on public.leaderboard_snapshots
  for select to authenticated
  using (public.is_tournament_member(auth.uid(), tournament_id));

-- ---- score_audit_logs, admin_overrides, sync_logs, system_events: ----
-- ---- read admin of the tournament (+ platform admin); write system/service role + admin-initiated ----

create policy "score_audit_logs_select_admin" on public.score_audit_logs
  for select to authenticated
  using (public.is_tournament_admin(auth.uid(), tournament_id));

create policy "score_audit_logs_insert_admin" on public.score_audit_logs
  for insert to authenticated
  with check (public.is_tournament_admin(auth.uid(), tournament_id) and acting_user_id = auth.uid());

create policy "admin_overrides_select_admin" on public.admin_overrides
  for select to authenticated
  using (public.is_tournament_admin(auth.uid(), tournament_id));

create policy "admin_overrides_insert_admin" on public.admin_overrides
  for insert to authenticated
  with check (public.is_tournament_admin(auth.uid(), tournament_id) and entered_by = auth.uid());

create policy "sync_logs_select_admin" on public.sync_logs
  for select to authenticated
  using (public.is_tournament_admin(auth.uid(), tournament_id));

create policy "system_events_select_admin" on public.system_events
  for select to authenticated
  using (tournament_id is null or public.is_tournament_admin(auth.uid(), tournament_id));

-- ---- notifications: a user reads/manages only their own ----

create policy "notifications_select_self" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_self" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
