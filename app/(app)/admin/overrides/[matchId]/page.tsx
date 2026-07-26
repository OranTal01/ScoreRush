import Link from "next/link";
import { notFound } from "next/navigation";
import {
  common,
  diagnostics as diagnosticsContent,
  overrides as content,
} from "@/lib/content/he";
import { getAdminContext } from "@/lib/auth/admin";
import { formatMatchTime } from "@/lib/mock";
import { createClient } from "@/lib/supabase/server";
import { getMatchDiagnostic } from "@/lib/sync/diagnostics";
import { Card, EmptyState } from "@/app/_components/ui";
import { MatchCorrectionForm } from "./_components/match-correction-form";

// Read live on every request — same rationale as the diagnostics pages this
// flow is linked from.
export const dynamic = "force-dynamic";

/**
 * Manual match-result correction entry point (ROADMAP.md Phase 7 task #61,
 * UX-BLUEPRINT.md §4 screens #8-9), linked from a match's diagnostics
 * detail page (../../diagnostics/[matchId]/page.tsx). Same admin-guard
 * shape as that page — derives the tournamentId to check membership
 * against from the match row itself, since a bare matchId route doesn't
 * know which tournament to check until the row is read.
 */
export default async function MatchCorrectionPage({
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

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[640px]">
      <h1 className="sr-only">{content.title}</h1>
      <Link
        href={`/admin/diagnostics/${matchId}`}
        className="text-xs font-semibold text-[var(--text-muted)]"
      >
        {`< ${content.backToMatch}`}
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
        <p className="text-xs text-[var(--text-secondary)]">
          {content.currentResultLabel}:{" "}
          <span className="ltr font-bold text-[var(--text-primary)] tabular-nums">
            {match.regularResult
              ? `${match.regularResult.home} – ${match.regularResult.away}`
              : diagnosticsContent.noResultYet}
          </span>
        </p>
      </Card>

      <MatchCorrectionForm
        matchId={matchId}
        tournamentId={match.tournamentId}
        homeTeamName={match.homeTeamName}
        awayTeamName={match.awayTeamName}
        currentResult={match.regularResult}
      />
    </div>
  );
}
