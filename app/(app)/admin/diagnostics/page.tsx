import Link from "next/link";
import {
  admin as adminContent,
  common,
  diagnostics as content,
} from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import { getAdminContext } from "@/lib/auth/admin";
import { formatMatchTime } from "@/lib/mock";
import { PROVIDER_LABELS } from "@/lib/providers/labels";
import { createClient } from "@/lib/supabase/server";
import {
  getMatchDiagnosticsList,
  getProviderHealth,
  getRecentSyncLogs,
  type MatchDiagnosticSummary,
} from "@/lib/sync/diagnostics";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { Card, EmptyState, Pill, SectionHeader, type StatusTone } from "@/app/_components/ui";

const STATUS_LABEL: Record<MatchDiagnosticSummary["status"], string> = {
  scheduled: content.statusScheduled,
  live: content.statusLive,
  finished: content.statusFinished,
  postponed: content.statusPostponed,
  cancelled: content.statusCancelled,
};

const STATUS_TONE: Record<MatchDiagnosticSummary["status"], StatusTone> = {
  scheduled: "muted",
  live: "danger",
  finished: "success",
  postponed: "muted",
  cancelled: "muted",
};

const NORMALIZATION_LABEL: Record<
  MatchDiagnosticSummary["normalizationStatus"],
  string
> = {
  pending: content.normalizationPending,
  normalized: content.normalizationNormalized,
  flagged: content.normalizationFlagged,
};

const NORMALIZATION_TONE: Record<
  MatchDiagnosticSummary["normalizationStatus"],
  StatusTone
> = {
  pending: "muted",
  normalized: "success",
  flagged: "danger",
};

// Read live on every request, same rationale as admin/page.tsx and
// admin/participants/page.tsx — this is a live operational screen, never
// statically cached.
export const dynamic = "force-dynamic";

/**
 * Match diagnostics + provider health + full sync log (UX-BLUEPRINT.md §4
 * screens #3-5, Phase 7 task #60). Read-only: no server actions, no
 * mutation surfaces — this screen only ever displays what the sync pipeline
 * (Phase 4) already wrote. Same guard sequence as
 * app/(app)/admin/participants/page.tsx.
 */
export default async function DiagnosticsPage() {
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

  const [providerHealth, syncLogEntries, matchList] = await Promise.all([
    getProviderHealth(tournamentId),
    getRecentSyncLogs(tournamentId, 50),
    getMatchDiagnosticsList(tournamentId),
  ]);

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[640px]">
      <h1 className="text-lg font-extrabold text-[var(--text-primary)]">
        {content.title}
      </h1>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.providerHealthSection} />
        {providerHealth === null ? (
          <EmptyState message={content.noProviderConfig} />
        ) : (
          <dl className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[var(--text-secondary)]">
                {content.matchDataProviderLabel}
              </dt>
              <dd className="font-bold text-[var(--text-primary)]">
                {PROVIDER_LABELS[providerHealth.matchDataProvider] ??
                  providerHealth.matchDataProvider}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[var(--text-secondary)]">
                {content.bonusStatsProviderLabel}
              </dt>
              <dd className="font-bold text-[var(--text-primary)]">
                {PROVIDER_LABELS[providerHealth.bonusStatsProvider] ??
                  providerHealth.bonusStatsProvider}
              </dd>
            </div>
            <div
              className="flex items-center justify-between gap-2 border-t pt-2"
              style={{ borderColor: colors.border }}
            >
              <dt className="text-[var(--text-secondary)]">
                {content.lastSuccessfulSyncLabel}
              </dt>
              <dd className="ltr font-bold text-[var(--text-primary)] tabular-nums">
                {providerHealth.lastSuccessfulSyncAt
                  ? formatMatchTime(providerHealth.lastSuccessfulSyncAt)
                  : content.neverSyncedLabel}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[var(--text-secondary)]">
                {content.lastAttemptLabel}
              </dt>
              <dd className="flex items-center gap-2">
                {providerHealth.lastAttemptAt && (
                  <span className="ltr text-[var(--text-muted)] tabular-nums">
                    {formatMatchTime(providerHealth.lastAttemptAt)}
                  </span>
                )}
                {providerHealth.lastOutcome ? (
                  <Pill
                    tone={
                      providerHealth.lastOutcome === "success"
                        ? "success"
                        : "danger"
                    }
                  >
                    {providerHealth.lastOutcome === "success"
                      ? adminContent.syncAttemptSuccess
                      : adminContent.syncAttemptFailed}
                  </Pill>
                ) : (
                  <span className="font-bold text-[var(--text-primary)]">
                    {content.neverSyncedLabel}
                  </span>
                )}
              </dd>
            </div>
            {providerHealth.recentAttemptCount > 0 && (
              <p className="text-[var(--text-muted)]">
                {content.recentErrorsLabel(
                  providerHealth.recentErrorCount,
                  providerHealth.recentAttemptCount,
                )}
              </p>
            )}
          </dl>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.syncLogSection} />
        {syncLogEntries.length === 0 ? (
          <EmptyState message={adminContent.noSyncLogsYet} />
        ) : (
          <ul className="flex flex-col gap-2">
            {syncLogEntries.map((log) => (
              <li
                key={log.id}
                className="flex flex-col gap-1 border-t pt-2 text-xs"
                style={{ borderColor: colors.border }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-secondary)]">
                    {PROVIDER_LABELS[log.provider] ?? log.provider}
                  </span>
                  <Pill tone={log.outcome === "success" ? "success" : "danger"}>
                    {log.outcome === "success"
                      ? adminContent.syncAttemptSuccess
                      : adminContent.syncAttemptFailed}{" "}
                    ·{" "}
                    <span className="ltr tabular-nums">{log.durationMs}ms</span>
                  </Pill>
                </div>
                <span className="ltr text-[var(--text-muted)] tabular-nums">
                  {formatMatchTime(log.timestamp)}
                </span>
                {log.errorDetail && (
                  <p className="text-[var(--text-muted)]">{log.errorDetail}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.matchListSection} />
        {matchList.length === 0 ? (
          <EmptyState message={content.matchListEmpty} />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {matchList.map((match) => (
              <li key={match.id}>
                <Link
                  href={`/admin/diagnostics/${match.id}`}
                  className="flex flex-col gap-1 border-b pb-2.5 text-xs last:border-b-0 last:pb-0"
                  style={{ borderColor: colors.border }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--text-secondary)]">
                      {match.homeTeamName} {common.vs} {match.awayTeamName}
                    </span>
                    <span className="ltr text-[10.5px] text-[var(--text-muted)] tabular-nums">
                      {formatMatchTime(match.kickoff)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={STATUS_TONE[match.status]}>
                      {STATUS_LABEL[match.status]}
                    </Pill>
                    <Pill tone={NORMALIZATION_TONE[match.normalizationStatus]}>
                      {NORMALIZATION_LABEL[match.normalizationStatus]}
                    </Pill>
                    <span className="text-[var(--interactive)]">
                      {content.viewDetailCta}
                    </span>
                  </div>
                  {match.warningFlag && (
                    <p className="text-[var(--text-muted)]">
                      {match.warningFlag}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
