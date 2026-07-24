"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth/admin";
import { getOrigin } from "@/lib/auth/get-origin";

/**
 * Participant management actions (UX-BLUEPRINT.md §4 screen #2: "Member
 * list, roles, invitation status, remove/re-invite"). Unlike
 * app/(app)/admin/tournaments/new/actions.ts (Phase 7 task #58), these use
 * the RLS-scoped `supabase` client, not the service-role `db` client: the
 * relevant policies (`participants_update_self_or_admin`,
 * `participants_delete_admin`, `invitations_insert_admin`,
 * `invitations_update_admin` — lib/db/migrations/0001_rls_policies.sql)
 * already let an authenticated tournament admin write these tables
 * directly, so there's no multi-table-atomicity reason to bypass RLS the
 * way tournament creation needed to.
 *
 * Every action re-derives `getAdminContext` from the submitted
 * `tournamentId` rather than trusting the calling page's own guard —
 * defense in depth on top of RLS (lib/auth/admin.ts doc comment), the same
 * pattern every other admin action in this codebase follows.
 */

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const uuidSchema = z.string().uuid();

export type ParticipantsErrorCode =
  | "invalid_input"
  | "unauthenticated"
  | "not_admin"
  | "cannot_remove_self"
  | "cannot_change_own_role"
  | "not_found"
  | "generic";

export type ParticipantActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; code: ParticipantsErrorCode };

type AdminCheckResult =
  | { ok: true; supabase: SupabaseServerClient; userId: string }
  | { ok: false; code: "unauthenticated" | "not_admin" };

async function requireAdmin(tournamentId: string): Promise<AdminCheckResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "unauthenticated" };
  }
  const { isAdmin } = await getAdminContext(supabase, user.id, tournamentId);
  if (!isAdmin) {
    return { ok: false, code: "not_admin" };
  }
  return { ok: true, supabase, userId: user.id };
}

const removeInputSchema = z.object({
  participantId: uuidSchema,
  tournamentId: uuidSchema,
});

/** Removes a participant (RLS: `participants_delete_admin`). Guards against
 * an admin removing their own membership through this screen — there's no
 * legitimate "remove myself" use case here, only room for an accidental
 * click locking an admin out of their own tournament. */
export async function removeParticipant(
  _prevState: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  const parsed = removeInputSchema.safeParse({
    participantId: formData.get("participantId"),
    tournamentId: formData.get("tournamentId"),
  });
  if (!parsed.success) return { status: "error", code: "invalid_input" };
  const { participantId, tournamentId } = parsed.data;

  const auth = await requireAdmin(tournamentId);
  if (!auth.ok) return { status: "error", code: auth.code };
  const { supabase, userId } = auth;

  const { data: participant } = await supabase
    .from("participants")
    .select("user_id")
    .eq("id", participantId)
    .eq("tournament_id", tournamentId)
    .maybeSingle<{ user_id: string }>();

  if (!participant) return { status: "error", code: "not_found" };
  if (participant.user_id === userId) {
    return { status: "error", code: "cannot_remove_self" };
  }

  const { error } = await supabase
    .from("participants")
    .delete()
    .eq("id", participantId)
    .eq("tournament_id", tournamentId);

  if (error) return { status: "error", code: "generic" };

  revalidatePath("/admin/participants");
  return { status: "success" };
}

const roleChangeInputSchema = z.object({
  participantId: uuidSchema,
  tournamentId: uuidSchema,
  role: z.enum(["tournament_admin", "participant"]),
});

/** Toggles a participant's role (RLS: `participants_update_self_or_admin` +
 * the `participants_prevent_self_role_escalation` trigger). Also guards
 * against an admin changing their *own* role through this screen: the
 * trigger only stops a non-admin from self-escalating, it would happily let
 * an admin demote themselves, which could leave a tournament with no
 * reachable admin other than the platform owner. */
export async function changeParticipantRole(
  _prevState: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  const parsed = roleChangeInputSchema.safeParse({
    participantId: formData.get("participantId"),
    tournamentId: formData.get("tournamentId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { status: "error", code: "invalid_input" };
  const { participantId, tournamentId, role } = parsed.data;

  const auth = await requireAdmin(tournamentId);
  if (!auth.ok) return { status: "error", code: auth.code };
  const { supabase, userId } = auth;

  const { data: participant } = await supabase
    .from("participants")
    .select("user_id")
    .eq("id", participantId)
    .eq("tournament_id", tournamentId)
    .maybeSingle<{ user_id: string }>();

  if (!participant) return { status: "error", code: "not_found" };
  if (participant.user_id === userId) {
    return { status: "error", code: "cannot_change_own_role" };
  }

  const { error } = await supabase
    .from("participants")
    .update({ role })
    .eq("id", participantId)
    .eq("tournament_id", tournamentId);

  if (error) return { status: "error", code: "generic" };

  revalidatePath("/admin/participants");
  return { status: "success" };
}

const revokeInputSchema = z.object({
  invitationId: uuidSchema,
  tournamentId: uuidSchema,
});

/** Revokes a still-pending invitation (RLS: `invitations_update_admin`).
 * Scoped to `status = "pending"` so this can't "un-revoke" or clobber an
 * already-consumed/expired invitation. */
export async function revokeInvitation(
  _prevState: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  const parsed = revokeInputSchema.safeParse({
    invitationId: formData.get("invitationId"),
    tournamentId: formData.get("tournamentId"),
  });
  if (!parsed.success) return { status: "error", code: "invalid_input" };
  const { invitationId, tournamentId } = parsed.data;

  const auth = await requireAdmin(tournamentId);
  if (!auth.ok) return { status: "error", code: auth.code };
  const { supabase } = auth;

  const { data } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("tournament_id", tournamentId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!data) return { status: "error", code: "not_found" };

  revalidatePath("/admin/participants");
  return { status: "success" };
}

const createInvitationInputSchema = z.object({
  tournamentId: uuidSchema,
  boundEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
    z.string().email().optional(),
  ),
});

export type CreateInvitationState =
  | { status: "idle" }
  | { status: "success"; joinUrl: string }
  | { status: "error"; code: ParticipantsErrorCode };

// No documented expiry-duration convention exists anywhere (DECISIONS.md /
// DATABASE.md only say invitations are "single-use, expirable tokens", not
// for how long) — 14 days is a judgment call: long enough that a
// WhatsApp/email-shared link doesn't go stale before the invitee gets to
// it, short enough that a forgotten link doesn't stay valid indefinitely.
const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Creates a new invitation (RLS: `invitations_insert_admin`, which also
 * requires `created_by = auth.uid()`). Returns the full `/join/{token}`
 * link for the admin to copy — there's no notification channel yet
 * (Phase 8) to deliver it automatically. */
export async function createInvitation(
  _prevState: CreateInvitationState,
  formData: FormData,
): Promise<CreateInvitationState> {
  const parsed = createInvitationInputSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    boundEmail: formData.get("boundEmail"),
  });
  if (!parsed.success) return { status: "error", code: "invalid_input" };
  const { tournamentId, boundEmail } = parsed.data;

  const auth = await requireAdmin(tournamentId);
  if (!auth.ok) return { status: "error", code: auth.code };
  const { supabase, userId } = auth;

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      tournament_id: tournamentId,
      token,
      bound_email: boundEmail ?? null,
      created_by: userId,
      expires_at: expiresAt,
    })
    .select("token")
    .single<{ token: string }>();

  if (error || !data) return { status: "error", code: "generic" };

  const origin = await getOrigin();
  revalidatePath("/admin/participants");
  return { status: "success", joinUrl: `${origin}/join/${data.token}` };
}
