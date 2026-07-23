-- =============================================================================
-- Invitation preview RPC.
--
-- UX-BLUEPRINT.md §3 screen 3 ("Join tournament (invitation landing):
-- Resolves an invitation link/token, shows tournament summary, confirms
-- join") requires showing a tournament summary *before* the user commits to
-- consume_invitation() — including while signed out, so a WhatsApp-shared
-- invite link is self-explanatory before asking someone to sign in.
--
-- 0001_rls_policies.sql only grants SELECT on invitations to tournament
-- admins ("invitations_select_admin"), which is correct for the admin
-- management screens but means a joining participant can never read the
-- invitation row directly. Same shape of problem as consume_invitation()
-- itself (DATABASE.md §5: "consumption is a controlled server-side flow,
-- not direct table write") — solved the same way: a narrow SECURITY DEFINER
-- function that returns only the fields a not-yet-joined visitor needs
-- (tournament name/competition/status), never the row itself.
-- =============================================================================

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
  select t.name, t.competition, v_invitation.status
  from public.tournaments t
  where t.id = v_invitation.tournament_id;
end;
$$;
