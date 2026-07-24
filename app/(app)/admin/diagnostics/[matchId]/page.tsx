import Link from "next/link";
import { notFound } from "next/navigation";
import { common, diagnostics as content } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import { getAdminContext } from "@/lib/auth/admin";
import { formatMatchTime } from "@/lib/mock";
import { createClient } from "@/lib/supabase/server";
import {
  getMatchDiagnostic,
  type MatchDiagnosticDetail,
} from "@/lib/sync/diagnostics";
import { Card, EmptyState, Pill, SectionHeader } from "@/app/_components/ui";

type MatchScore = { home: number; away: number };

function ScoreRow({
  label,
  score,
}: {
  label: string;
  score: MatchScore | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-[var(--text-secondary)]">{label}</span>
      {score ? (
        <span className="ltr font-bold text-[var(--text-primary)] tabular-nums">
          {score.home} – {score.away}
        </span>
      ) : (
        <span className="text-[var(--text-muted)]">{content.noResultYet}</span>
      )}
    </div>
  );
}

function winnerLabel(match: MatchDiagnosticDetail): string | null {
  if (match.winner === "home") return match.homeTeamName;
  if (match.winner === "away") return match.awayTeamName;
  if (match.winner === "draw") return content.winnerDrawLabel;
  return null;
}

// Read live on every request — same rationale as the diagnostics list page.
export const dynamic = "force-dynamic";

/**
 * Per-match raw-vs-normalized drill-down (UX-BLUEPRINT.md §4 screen #3),
 * linked from the diagnostics list (../page.tsx). Deliberately derives the
 * admin guard's tournamentId from the match row itself rather than from
 * `getCurrentParticipant` — same shape as
 * app/(app)/predictions/[matchId]/page.tsx, since a matchId alone doesn't
 * tell us which tournament to check membership against until we've read the
 * row.
 */
export default async function MatchDiagnosticPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <EmptyState message={content.errorUnauthenticated} />;
  }

  const match = await getMatchDiagnostic(matchId);
  if (!match) {
    notFound();
  }

  const { isAdmin } = await getAdminContext(
    supabase,
    user.id,
    match.tournamentId,
  );
  if (!isAdmin) {
    return <EmptyState message={content.errorNotAdmin} />;
  }

  const winner = winnerLabel(match);
  const rawPayloadJson = match.rawProviderPayload
    ? JSON.stringify(match.rawProviderPayload, null, 2)
    : null;

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[640px]">
      <Link
        href="/admin/diagnostics"
        className="text-xs font-semibold text-[var(--text-muted)]"
      >
        {`< ${content.backToDiagnostics}`}
      </Link>

      <Card padding="hero" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-extrabold text-[var(--text-primary)]">
            {match.homeTeamName} {common.vs} {match.awayTeamName}
          </span>
          <span className="ltr text-xs text-[var(--text-muted)] tabular-nums">
            {formatMatchTime(match.kickoff)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <span>
            {match.providerId
              ? `${content.providerMatchIdLabel}: ${match.providerId}`
              : content.manualEntryLabel}
          </span>
          <span>
            ·{" "}
            {match.lastSyncedAt
              ? `${content.lastSyncedLabel}: ${formatMatchTime(match.lastSyncedAt)}`
              : content.neverSyncedLabel}
          </span>
        </div>
        {winner && (
          <p className="text-xs text-[var(--text-secondary)]">
            {content.winnerLabel}:{" "}
            <span className="font-bold text-[var(--text-primary)]">
              {winner}
            </span>
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader
          title={content.normalizedResultSection}
          action={
            <Pill
              tone={
                match.normalizationStatus === "flagged"
                  ? "danger"
                  : match.normalizationStatus === "normalized"
                    ? "success"
                    : "muted"
              }
            >
              {match.normalizationStatus === "flagged"
                ? content.normalizationFlagged
                : match.normalizationStatus === "normalized"
                  ? content.normalizationNormalized
                  : content.normalizationPending}
            </Pill>
          }
        />
        <div className="flex flex-col gap-2">
          <ScoreRow label={content.regularResultLabel} score={match.regularResult} />
          <ScoreRow
            label={content.extraTimeResultLabel}
            score={match.extraTimeResult}
          />
          <ScoreRow label={content.penaltyResultLabel} score={match.penaltyResult} />
          <ScoreRow label={content.liveScoreLabel} score={match.liveScore} />
        </div>
        <p
          className="border-t pt-2 text-xs text-[var(--text-secondary)]"
          style={{ borderColor: colors.border }}
        >
          {content.warningLabel}:{" "}
          <span
            className={
              match.warningFlag
                ? "font-semibold text-[var(--danger)]"
                : "text-[var(--text-muted)]"
            }
          >
            {match.warningFlag ?? content.noWarning}
          </span>
        </p>
        <Link
          href={`/admin/overrides/${match.id}`}
          className="w-fit text-xs font-bold text-[var(--interactive)]"
        >
          {content.correctResultCta}
        </Link>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.rawPayloadSection} />
        {rawPayloadJson ? (
          <pre
            dir="ltr"
            className="max-h-[400px] overflow-auto whitespace-pre-wrap break-all p-3 text-start text-[10.5px] text-[var(--text-secondary)]"
            style={{
              background: colors.surfaceCard2,
              borderRadius: "var(--radius-button)",
            }}
          >
            {rawPayloadJson}
          </pre>
        ) : (
          <EmptyState message={content.rawPayloadEmpty} />
        )}
      </Card>
    </div>
  );
}
