import { participantsAdmin as content } from "@/lib/content/he";
import { getAdminContext } from "@/lib/auth/admin";
import { getOrigin } from "@/lib/auth/get-origin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { EmptyState } from "@/app/_components/ui";
import { ParticipantsAdminScreen } from "./_components/participants-admin-screen";

type ParticipantQueryRow = {
  id: string;
  user_id: string;
  role: "tournament_admin" | "participant";
  display_name: string;
  avatar_initials: string | null;
  joined_at: string;
};

type InvitationQueryRow = {
  id: string;
  token: string;
  bound_email: string | null;
  status: "pending" | "consumed" | "expired" | "revoked";
  expires_at: string | null;
  created_at: string;
};

// This screen reads live membership/invitation state on every request —
// caching it would mean an admin sees a stale member list or a just-revoked
// invitation as still-pending.
export const dynamic = "force-dynamic";

/**
 * Participant management screen (UX-BLUEPRINT.md §4 screen #2: "Member
 * list, roles, invitation status, remove/re-invite", Phase 7 task #59).
 * Same guard shape as app/(app)/admin/page.tsx (lib/auth/admin.ts, task
 * #57): unauthenticated -> errorUnauthenticated; no current tournament
 * membership -> errorNotAMember (a platform owner with zero tournaments has
 * nothing to manage here yet — that bootstrap case is handled on the
 * overview page, not this sub-screen); member but not admin ->
 * errorNotAdmin; admin -> the real screen.
 *
 * Reads `participants`/`invitations` through the RLS-scoped client, not the
 * service-role one — `participants_select_members` and
 * `invitations_select_admin` (lib/db/migrations/0001_rls_policies.sql)
 * already grant exactly the read this admin needs, matching the write
 * actions in ./actions.ts.
 */
export default async function ParticipantsAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <EmptyState message={content.errorUnauthenticated} />;
  }

  const current = await getCurrentParticipant(supabase, user.id);
  if (!current) {
    return <EmptyState message={content.errorNotAMember} />;
  }
  const { tournamentId } = current;

  const { isAdmin } = await getAdminContext(supabase, user.id, tournamentId);
  if (!isAdmin) {
    return <EmptyState message={content.errorNotAdmin} />;
  }

  const [{ data: participantRows }, { data: invitationRows }, origin] =
    await Promise.all([
      supabase
        .from("participants")
        .select(
          "id, user_id, role, display_name, avatar_initials, joined_at",
        )
        .eq("tournament_id", tournamentId)
        .order("joined_at", { ascending: true })
        .returns<ParticipantQueryRow[]>(),
      supabase
        .from("invitations")
        .select("id, token, bound_email, status, expires_at, created_at")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: false })
        .returns<InvitationQueryRow[]>(),
      getOrigin(),
    ]);

  const participants = (participantRows ?? []).map((p) => ({
    id: p.id,
    userId: p.user_id,
    role: p.role,
    displayName: p.display_name,
    avatarInitials: p.avatar_initials,
    joinedAt: p.joined_at,
  }));

  const invitations = (invitationRows ?? []).map((i) => ({
    id: i.id,
    joinUrl: `${origin}/join/${i.token}`,
    boundEmail: i.bound_email,
    status: i.status,
    expiresAt: i.expires_at,
    createdAt: i.created_at,
  }));

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[640px]">
      <h1 className="text-lg font-extrabold text-[var(--text-primary)]">
        {content.title}
      </h1>
      <ParticipantsAdminScreen
        tournamentId={tournamentId}
        currentUserId={user.id}
        participants={participants}
        invitations={invitations}
      />
    </div>
  );
}
