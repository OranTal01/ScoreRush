import { auditLog as content, common } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import { getAdminContext } from "@/lib/auth/admin";
import { getAuditLog, type AuditLogEntry } from "@/lib/audit/log";
import { formatMatchTime } from "@/lib/mock";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { AdminSubTabs } from "@/app/_components/nav/admin-sub-tabs";
import { Card, EmptyState, Pill } from "@/app/_components/ui";

/** Renders one previous/new audit value with the right formatting for its field — a
 * `{ home, away }` score object, a "winner" enum string, or a generic fallback for
 * whatever future entity/field combos get added. */
function AuditValue({
  field,
  value,
}: {
  field: string;
  value: unknown;
}) {
  if (value === null || value === undefined) {
    return <span className="text-[var(--text-muted)]">{content.noValue}</span>;
  }
  if (field === "winner" && typeof value === "string") {
    return <span>{content.winnerValueLabels[value] ?? value}</span>;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "home" in value &&
    "away" in value
  ) {
    const score = value as { home: number; away: number };
    return (
      <span className="ltr tabular-nums">
        {score.home} – {score.away}
      </span>
    );
  }
  return <span>{String(value)}</span>;
}

function AuditEntryCard({ entry }: { entry: AuditLogEntry }) {
  return (
    <li
      className="flex flex-col gap-2 border-b pb-3 text-xs last:border-b-0 last:pb-0"
      style={{ borderColor: colors.border }}
    >
      <div className="flex items-center justify-between gap-2">
        <Pill tone={entry.type === "override" ? "danger" : "interactive"}>
          {entry.type === "override"
            ? content.overrideTypeLabel
            : content.scoreChangeTypeLabel}
        </Pill>
        <span className="ltr text-[10.5px] text-[var(--text-muted)] tabular-nums">
          {formatMatchTime(entry.timestamp)}
        </span>
      </div>

      <p className="text-[var(--text-secondary)]">
        {content.actingAdminLabel}:{" "}
        <span className="font-bold text-[var(--text-primary)]">
          {entry.actingAdminName}
        </span>
      </p>

      {entry.type === "score_change" && (
        <p className="text-[var(--text-secondary)]">
          {(content.entityLabels[entry.entity] ?? entry.entity)}
          {entry.match && (
            <>
              {" · "}
              {entry.match.homeTeamName} {common.vs} {entry.match.awayTeamName}
            </>
          )}
          {" · "}
          <span className="font-bold text-[var(--text-primary)]">
            {content.fieldLabels[entry.field] ?? entry.field}
          </span>
          {": "}
          <AuditValue field={entry.field} value={entry.previousValue} />
          {" → "}
          <AuditValue field={entry.field} value={entry.newValue} />
        </p>
      )}

      <p className="text-[var(--text-muted)]">
        {content.reasonLabel}: {entry.reason}
      </p>

      {entry.type === "override" && (
        <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-[var(--text-muted)]">
          {entry.evidenceRef && (
            <span>
              {content.evidenceLabel}: {entry.evidenceRef}
            </span>
          )}
          <Pill tone={entry.reversible ? "muted" : "danger"}>
            {entry.reversible
              ? content.reversibleLabel
              : content.notReversibleLabel}
          </Pill>
          {entry.reversedAt && (
            <span>
              {content.reversedAtLabel}: {formatMatchTime(entry.reversedAt)}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

// Read live on every request — same rationale as the other admin diagnostic
// screens (app/(app)/admin/diagnostics/page.tsx): this is a live operational
// screen, never statically cached.
export const dynamic = "force-dynamic";

/**
 * Audit log viewer (UX-BLUEPRINT.md §4 screen #11: "Full chronological log
 * of all admin actions in the tournament", Phase 7 task #62). Read-only: no
 * server actions, no mutation surfaces — this screen only ever displays
 * what lib/audit/log.ts's getAuditLog already merged from `admin_overrides`
 * and `score_audit_logs`. Same guard sequence and list-page shape as
 * app/(app)/admin/diagnostics/page.tsx and app/(app)/admin/participants/page.tsx
 * — keyed off the admin's current tournament, not a route param.
 */
export default async function AuditLogPage() {
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

  const entries = await getAuditLog(tournamentId);

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
              <AuditEntryCard key={`${entry.type}-${entry.id}`} entry={entry} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
