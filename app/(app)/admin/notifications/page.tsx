import { notificationCenter as content } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import { getAdminContext } from "@/lib/auth/admin";
import {
  getNotificationLog,
  type NotificationLogEntry,
} from "@/lib/notifications/list";
import { formatMatchTime } from "@/lib/mock/clock";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { AdminSubTabs } from "@/app/_components/nav/admin-sub-tabs";
import { Card, EmptyState, Pill, type StatusTone } from "@/app/_components/ui";

const STATUS_TONE: Record<NotificationLogEntry["status"], StatusTone> = {
  pending: "muted",
  sent: "success",
  failed: "danger",
};

function NotificationEntryCard({ entry }: { entry: NotificationLogEntry }) {
  return (
    <li
      className="flex flex-col gap-2 border-b pb-3 text-xs last:border-b-0 last:pb-0"
      style={{ borderColor: colors.border }}
    >
      <div className="flex items-center justify-between gap-2">
        <Pill tone={STATUS_TONE[entry.status]}>
          {content.statusLabels[entry.status] ?? entry.status}
        </Pill>
        <span className="ltr text-[10.5px] text-[var(--text-muted)] tabular-nums">
          {formatMatchTime(entry.createdAt)}
        </span>
      </div>

      <p className="text-[var(--text-secondary)]">
        {content.recipientLabel}:{" "}
        <span className="ltr font-bold text-[var(--text-primary)]">
          {entry.recipientEmail}
        </span>
      </p>

      <p className="text-[var(--text-muted)]">
        {content.typeLabels[entry.type] ?? entry.type}
        {" · "}
        {content.channelLabels[entry.channel] ?? entry.channel}
      </p>

      {entry.status === "sent" && entry.sentAt && (
        <p className="text-[var(--text-muted)]">
          {content.sentAtLabel}: {formatMatchTime(entry.sentAt)}
        </p>
      )}

      {entry.status === "failed" && entry.errorDetail && (
        <p className="text-[var(--danger)]">
          {content.errorDetailLabel}: {entry.errorDetail}
        </p>
      )}
    </li>
  );
}

// Read live on every request — same rationale as the other admin diagnostic
// screens (app/(app)/admin/diagnostics/page.tsx, app/(app)/admin/audit/page.tsx):
// this is a live operational screen, never statically cached.
export const dynamic = "force-dynamic";

/**
 * Admin notification center (UX-BLUEPRINT.md §4 screen #10: "Delivery
 * status for sent notifications", Phase 8 task #68). Read-only: no server
 * actions, no mutation surfaces — this screen only ever displays what
 * lib/notifications/list.ts's getNotificationLog already reads from
 * `notifications` (the table task #67's invitation email flow writes to).
 * Same guard sequence and list-page shape as app/(app)/admin/audit/page.tsx.
 */
export default async function NotificationCenterPage() {
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

  const entries = await getNotificationLog(tournamentId);

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[640px]">
      <AdminSubTabs />
      <h1 className="text-lg font-extrabold text-[var(--text-primary)]">
        {content.title}
      </h1>

      <Card className="flex flex-col gap-3">
        {entries.length === 0 ? (
          <EmptyState message={content.empty} />
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <NotificationEntryCard key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
