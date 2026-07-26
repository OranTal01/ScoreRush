/**
 * Orchestrates sending the real invitation email (ROADMAP.md Phase 8 task
 * #67) and logging the outcome to `notifications` (DATABASE.md §2,
 * lib/db/schema/audit.ts) — the one piece of I/O `buildInvitationEmail`
 * (invitation-email.ts) deliberately stays free of.
 *
 * Uses the service-role `db` client, not the RLS-scoped `supabase` client
 * that app/(app)/admin/participants/actions.ts otherwise uses on this
 * screen: `notifications` has no INSERT RLS policy, matching `sync_logs`'
 * precedent (lib/sync/run-sync.ts) — a table written by system/service-role
 * code on behalf of a request, not one an authenticated user's own RLS
 * identity writes to directly (DATABASE.md §5's "System/service role +
 * admin-initiated actions only" family). There's also no atomicity
 * requirement tying this write to the invitation row itself the way
 * tournament creation (task #58) needed service-role access for — if this
 * whole module silently no-ops, the invitation still exists and its join
 * link still works.
 *
 * `sendInvitationEmail` never throws: a missing RESEND_API_KEY, a Resend
 * API error, or even a failure to write the notifications row itself must
 * never block invitation creation (task #67's whole point) or hide the
 * copyable join link the admin already has as a fallback delivery path
 * (ARCHITECTURE.md §5's throw-on-failure-at-the-adapter,
 * caller-decides-fallback contract — this module *is* the caller).
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema/audit";
import { tournaments } from "@/lib/db/schema/identity";
import { buildInvitationEmail } from "./invitation-email";
import { resendAdapter } from "./resend";
import type { NotificationMessage } from "./types";

export type InvitationEmailStatus = "sent" | "failed";

export async function sendInvitationEmail(params: {
  tournamentId: string;
  boundEmail: string;
  joinUrl: string;
}): Promise<InvitationEmailStatus> {
  const { tournamentId, boundEmail, joinUrl } = params;

  let tournamentName = "";
  try {
    const [tournament] = await db
      .select({ name: tournaments.name })
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);
    tournamentName = tournament?.name ?? "";
  } catch {
    // Falls through with a blank name rather than aborting the send — an
    // invitation email missing the tournament name is still better than no
    // email at all when only this lookup fails.
  }

  const message = buildInvitationEmail({ to: boundEmail, tournamentName, joinUrl });

  try {
    const result = await resendAdapter.send(message);
    await logNotification({
      tournamentId,
      boundEmail,
      message,
      status: "sent",
      providerMessageId: result.providerMessageId,
    });
    return "sent";
  } catch (err) {
    await logNotification({
      tournamentId,
      boundEmail,
      message,
      status: "failed",
      errorDetail: err instanceof Error ? err.message : String(err),
    });
    return "failed";
  }
}

async function logNotification(params: {
  tournamentId: string;
  boundEmail: string;
  message: NotificationMessage;
  status: InvitationEmailStatus;
  providerMessageId?: string;
  errorDetail?: string;
}): Promise<void> {
  try {
    await db.insert(notifications).values({
      tournamentId: params.tournamentId,
      recipientEmail: params.boundEmail,
      type: "invitation",
      channel: "email",
      status: params.status,
      subject: params.message.subject,
      body: params.message.html,
      providerMessageId: params.providerMessageId,
      errorDetail: params.errorDetail,
      sentAt: params.status === "sent" ? new Date() : null,
    });
  } catch {
    // Best-effort observability for the admin notification center (task
    // #68) — must never surface. The email send itself already
    // succeeded/failed independently of whether this log write lands.
  }
}
