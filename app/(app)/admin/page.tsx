import { colors } from "@/lib/design-tokens";
import { admin as content, common } from "@/lib/content/he";
import {
  adminOverrides,
  formatMatchTime,
  lastSyncAt,
  pendingLockMatches,
  syncHealth,
  syncLogs,
} from "@/lib/mock";
import { MatchCard } from "../../_components/match-card";
import {
  Card,
  EmptyState,
  Pill,
  SectionHeader,
  type StatusTone,
} from "../../_components/ui";

const HEALTH_TONE: Record<typeof syncHealth, StatusTone> = {
  healthy: "success",
  degraded: "gold",
  failed: "danger",
};

/** Admin screen 1 (UX-BLUEPRINT.md): tournament health at a glance — sync
 * status, pending predictions to lock, recent overrides. The admin entry
 * point in the header is only shown to admins (see header-actions.tsx); this
 * static prototype doesn't yet enforce a route guard for non-admins. */
export default function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[640px]">
      <h1 className="text-lg font-extrabold text-[var(--text-primary)]">
        {content.overviewTitle}
      </h1>

      <Card className="flex flex-col gap-3">
        <SectionHeader
          title={content.syncStatusLabel}
          action={
            <Pill tone={HEALTH_TONE[syncHealth]}>{content[syncHealth]}</Pill>
          }
        />
        <p className="text-xs text-[var(--text-secondary)]">
          {content.lastSyncLabel}:{" "}
          <span className="ltr tabular-nums">
            {formatMatchTime(lastSyncAt)}
          </span>
        </p>
        <ul className="flex flex-col gap-2">
          {syncLogs.map((log) => (
            <li
              key={log.id}
              className="flex flex-col gap-1 border-t pt-2 text-xs"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="ltr text-[var(--text-secondary)] tabular-nums">
                  {formatMatchTime(log.timestamp)}
                </span>
                <Pill tone={log.outcome === "success" ? "success" : "danger"}>
                  {log.outcome === "success"
                    ? content.syncAttemptSuccess
                    : content.syncAttemptFailed}{" "}
                  · <span className="ltr tabular-nums">{log.durationMs}ms</span>
                </Pill>
              </div>
              {log.errorDetail && (
                <p className="text-[var(--text-muted)]">{log.errorDetail}</p>
              )}
            </li>
          ))}
        </ul>
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
