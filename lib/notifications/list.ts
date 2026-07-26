/**
 * Read-side query backing the admin notification center (UX-BLUEPRINT.md §4
 * screen #10: "Delivery status for sent notifications", ROADMAP.md Phase 8
 * task #68). Uses the service-role `db` client with an explicit
 * `tournamentId` filter — same precedent as lib/audit/log.ts and
 * lib/sync/diagnostics.ts: it exists to serve one already-authorized
 * admin's own tournament page, so without the explicit filter the
 * service-role client would happily return every tournament's rows.
 *
 * `notifications_select_self` (lib/db/migrations/0001_rls_policies.sql)
 * wouldn't cover this screen even for a direct RLS-scoped read: `userId` is
 * null for invitation-email rows (lib/db/schema/audit.ts's doc comment —
 * the recipient has no `users` row yet), and this screen's whole point is
 * showing an *admin* every notification for their tournament, not a
 * participant their own. `notifications_select_admin`
 * (lib/db/migrations/0005_notifications_admin_select.sql) documents that
 * broader visibility in RLS for defense in depth, matching
 * `sync_logs_select_admin`/`score_audit_logs_select_admin`'s precedent,
 * even though this code path reads via the service-role client instead.
 */
import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema/audit";

export interface NotificationLogEntry {
  id: string;
  recipientEmail: string;
  /** e.g. "invitation" — free text, mirrors `notifications.type`. */
  type: string;
  /** e.g. "email" — mirrors `notifications.channel`. */
  channel: string;
  status: "pending" | "sent" | "failed";
  /** ISO 8601, or null if never sent (still pending, or failed). */
  sentAt: string | null;
  /** Populated only when status is "failed". */
  errorDetail: string | null;
  /** ISO 8601. */
  createdAt: string;
}

export async function getNotificationLog(
  tournamentId: string,
  limit = 100,
): Promise<NotificationLogEntry[]> {
  const rows = await db
    .select({
      id: notifications.id,
      recipientEmail: notifications.recipientEmail,
      type: notifications.type,
      channel: notifications.channel,
      status: notifications.status,
      sentAt: notifications.sentAt,
      errorDetail: notifications.errorDetail,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.tournamentId, tournamentId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    recipientEmail: row.recipientEmail,
    type: row.type,
    channel: row.channel,
    status: row.status,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    errorDetail: row.errorDetail,
    createdAt: row.createdAt.toISOString(),
  }));
}
