import { bracket, nav, predictions as content } from "@/lib/content/he";
import { listTournamentMatches, type MatchWithTeams } from "@/lib/matches/list";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { MatchCard } from "../../_components/match-card";
import { MotionIn } from "../../_components/motion/motion-in";
import { SubTabs } from "../../_components/nav/sub-tabs";
import { EmptyState, SectionHeader } from "../../_components/ui";

// `stage` is free text (DATABASE.md §3 / lib/db/schema/competition.ts), not a
// closed union — only the World-Cup-shaped knockout stages get a dedicated
// label; anything else (a custom stage, or "group" without a matchday) falls
// back to matchday or the raw stage string, never a fabricated label.
const STAGE_LABELS: Record<string, string> = {
  semifinal: bracket.semiFinal,
  final: bracket.final,
  round_of_16: bracket.roundOf16,
  quarter_final: bracket.quarterFinal,
};

function stageLabel(match: MatchWithTeams): string {
  return (
    STAGE_LABELS[match.stage] ??
    (match.matchday !== null
      ? content.matchdayLabel(match.matchday)
      : match.stage)
  );
}

/** Matches come back kickoff-ascending from `listTournamentMatches` (already
 * effectively stage/matchday-ordered in practice), so a single pass groups
 * consecutive matches sharing a label — no re-sort needed. */
function groupByStage(
  list: MatchWithTeams[],
): { label: string; matches: MatchWithTeams[] }[] {
  const sections: { label: string; matches: MatchWithTeams[] }[] = [];
  for (const match of list) {
    const label = stageLabel(match);
    const current = sections[sections.length - 1];
    if (current && current.label === label) {
      current.matches.push(match);
    } else {
      sections.push({ label, matches: [match] });
    }
  }
  return sections;
}

// Lock status and live scores change independently of any admin action, so
// this must never be statically cached (same rationale as
// predictions/[matchId]/page.tsx and leaderboard/page.tsx).
export const dynamic = "force-dynamic";

/**
 * Screen 5 (UX-BLUEPRINT.md): all matches for the active tournament, grouped
 * by stage/matchday, with lock-time status and the caller's own prediction
 * per match via the shared `MatchCard`.
 *
 * Real-data pass (ROADMAP.md Phase 9 gap-fill, predates the phase itself) —
 * this screen ran on `@/lib/mock` fixtures through Phases 2-8, see
 * lib/matches/list.ts's doc comment for why. Guard chain mirrors
 * leaderboard/page.tsx: unauthenticated / not-a-member both render
 * `EmptyState` rather than an empty match list.
 */
export default async function PredictionsPage() {
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

  const matches = await listTournamentMatches(
    supabase,
    current.tournamentId,
    current.participantId,
  );
  const sections = groupByStage(matches);
  // Stagger runs across the whole flattened list (not reset per stage
  // section) so the cascade reads as one continuous top-to-bottom reveal.
  let staggerIndex = 0;

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[560px] lg:max-w-[640px]">
      <h1 className="sr-only">{nav.predictions}</h1>
      <SubTabs />
      {sections.length === 0 ? (
        <EmptyState message={content.emptyState} />
      ) : (
        sections.map((section) => (
          <div key={section.label} className="flex flex-col gap-2">
            <SectionHeader title={section.label} />
            <div className="flex flex-col gap-2.5">
              {section.matches.map((match) => (
                <MotionIn key={match.id} index={staggerIndex++}>
                  <MatchCard match={match} />
                </MotionIn>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
