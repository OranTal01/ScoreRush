-- Existing personal invitations retain their single-use semantics.
alter table public.invitations add column max_uses integer not null default 1 check(max_uses between 1 and 100);
alter table public.invitations add column use_count integer not null default 0 check(use_count >= 0 and use_count <= max_uses);
update public.invitations set use_count=1 where status='consumed';
--> statement-breakpoint
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

  if v_invitation.status <> 'pending' or v_invitation.use_count >= v_invitation.max_uses then
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
  set use_count = use_count + 1,
      status = case when use_count + 1 >= max_uses then 'consumed'::public.invitation_status else 'pending'::public.invitation_status end,
      consumed_by = auth.uid(), consumed_at = now()
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
--> statement-breakpoint
create or replace function public.preview_invitation(p_token text)
returns table (
  tournament_name text,
  competition text,
  invitation_status public.invitation_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations%rowtype;
begin
  select * into v_invitation from public.invitations where token = p_token;

  if not found then
    raise exception 'Invalid invitation token';
  end if;

  return query
  select t.name, t.competition, case when v_invitation.status='pending' and v_invitation.expires_at <= now() then 'expired'::public.invitation_status else v_invitation.status end
  from public.tournaments t
  where t.id = v_invitation.tournament_id;
end;
$$;
