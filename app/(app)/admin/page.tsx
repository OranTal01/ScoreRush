import { colors } from "@/lib/design-tokens";
import { admin as content, common } from "@/lib/content/he";
import { getAdminContext } from "@/lib/auth/admin";
import {
  adminOverrides,
  formatMatchTime,
  pendingLockMatches,
} from "@/lib/mock";
import { createClient } from "@/lib/supabase/server";
import { getFlaggedMatches, getRecentSyncLogs } from "@/lib/sync/diagnostics";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { MatchCard } from "../../_components/match-card";
import {
  Card,
  EmptyState,
  Pill,
  SectionHeader,
  type StatusTone,
} from "../../_components/ui";

type SyncHealth = "healthy" | "failed";

const HEALTH_TONE: Record<SyncHealth, StatusTone> = {
  healthy: "success",
  failed: "danger",
};

/** Friendly label for a `tournament_providers` provider name (ARCHITECTURE.md §6) — falls back to the raw value for any future provider added without a UI update. */
const PROVIDER_LABELS: Record<string, string> = {
  football_data_org: "football-data.org",
  manual: "ידני",
};

// Sync/normalization diagnostics are read live from the database on every
// request (lib/sync/diagnostics.ts) — this page must never be statically
// cached with build-time data, or an admin would see stale sync history
// forever (ARCHITECTURE.md §7).
export const dynamic = "force-dynamic";

/**
 * Admin screen 1 (UX-BLUEPRINT.md): tournament health at a glance. The
 * sync-status and flagged-matches cards are wired to the real database
 * (ROADMAP.md Phase 4: "diagnostics surfaced in the admin UI") — the first
 * real-data-backed screen in the app, since everything else is still
 * Phase-2 mock UI. Pending-locks and recent-overrides below still read mock
 * data: real prediction data (Phase 5) and an overrides-entry UI (Phase 7)
 * don't exist yet, so there's nothing real to show there yet.
 *
 * The admin entry point in the header is only shown to admins
 * (header-actions.tsx), and this page now also enforces the guard
 * server-side (ROADMAP.md Phase 7 task #57, lib/auth/admin.ts) — the header
 * link hiding it was UX only, never actual access control, since a
 * non-admin could always type the URL directly.
 */
export default async function AdminOverviewPage() {
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

  const [syncLogEntries, flaggedMatches] = await Promise.all([
    getRecentSyncLogs(tournamentId),
    getFlaggedMatches(tournamentId),
  ]);
  const latestLog = syncLogEntries[0] ?? null;
  const syncHealth: SyncHealth | null = latestLog
    ? latestLog.outcome === "success"
      ? "healthy"
      : "failed"
    : null;

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[640px]">
      <h1 className="text-lg font-extrabold text-[var(--text-primary)]">
        {content.overviewTitle}
      </h1>

      <Card className="flex flex-col gap-3">
        <SectionHeader
          title={content.syncStatusLabel}
          action={
            <Pill tone={syncHealth ? HEALTH_TONE[syncHealth] : "muted"}>
              {syncHealth ? content[syncHealth] : content.noSyncYet}
            </Pill>
          }
        />
        {latestLog && (
          <p className="text-xs text-[var(--text-secondary)]">
            {content.lastSyncLabel}:{" "}
            <span className="ltr tabular-nums">
              {formatMatchTime(latestLog.timestamp)}
            </span>
          </p>
        )}
        {syncLogEntries.length === 0 ? (
          <EmptyState message={content.noSyncLogsYet} />
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
                    {log.tournamentName} ·{" "}
                    {PROVIDER_LABELS[log.provider] ?? log.provider}
                  </span>
                  <Pill tone={log.outcome === "success" ? "success" : "danger"}>
                    {log.outcome === "success"
                      ? content.syncAttemptSuccess
                      : content.syncAttemptFailed}{" "}
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
        <SectionHeader title={content.flaggedMatchesLabel} />
        {flaggedMatches.length === 0 ? (
          <EmptyState message={content.flaggedMatchesEmpty} />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {flaggedMatches.map((match) => (
              <li
                key={match.id}
                className="flex flex-col gap-1 border-b pb-2.5 text-xs last:border-b-0 last:pb-0"
                style={{ borderColor: colors.border }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-secondary)]">
                    {match.tournamentName} · {match.homeTeamName} {common.vs}{" "}
                    {match.awayTeamName}
                  </span>
                  <span className="ltr text-[10.5px] text-[var(--text-muted)] tabular-nums">
                    {formatMatchTime(match.kickoff)}
                  </span>
                </div>
                <p className="text-[var(--text-muted)]">{match.warningFlag}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.pendingLocksLabel} />
        {pendingLockMatches.length === 0 ? (
          <EmptyState message={common.emptyGeneric} />
        ) : (
          <div className="flex flex-col gap-2.5">
            {pendingLockMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.recentOverridesLabel} />
        {adminOverrides.length === 0 ? (
          <EmptyState message={common.emptyGeneric} />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {adminOverrides.map((override) => (
              <li
                key={override.id}
                className="flex flex-col gap-1 border-b pb-2.5 text-xs last:border-b-0 last:pb-0"
                style={{ borderColor: colors.border }}
              >
                <p className="text-[var(--text-secondary)]">
                  {override.reason}
                </p>
                <div className="flex items-center justify-between gap-2 text-[10.5px] text-[var(--text-muted)]">
                  <span>
                    {override.enteredBy} ·{" "}
                    <span className="ltr tabular-nums">
                      {formatMatchTime(override.timestamp)}
                    </span>
                  </span>
                  {override.reversible && (
                    <Pill tone="muted">{content.reversibleLabel}</Pill>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
