import { colors } from "@/lib/design-tokens";
import { bracket as content, nav } from "@/lib/content/he";
import { listTournamentMatches } from "@/lib/matches/list";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { MatchCard } from "../../_components/match-card";
import { MotionIn } from "../../_components/motion/motion-in";
import { SubTabs } from "../../_components/nav/sub-tabs";
import { EmptyState, SectionHeader } from "../../_components/ui";

// Lock status and live scores change independently of any admin action, so
// this must never be statically cached (same rationale as
// predictions/page.tsx and leaderboard/page.tsx).
export const dynamic = "force-dynamic";

/**
 * Screen 12 (UX-BLUEPRINT.md): knockout bracket visualization — semifinal +
 * final rounds only, same scope as the Phase 2 mock tournament this replaces
 * (8 teams, top 2 per group advance directly). Teams are still TBD until the
 * group stage finishes, which `MatchCard`'s `TeamLabel` already renders as
 * "טרם נקבע" (a null `homeTeam`/`awayTeam`, never fabricated).
 *
 * Real-data pass (ROADMAP.md Phase 9 gap-fill, predates the phase itself) —
 * this screen ran on `@/lib/mock` fixtures through Phases 2-8, see
 * lib/matches/list.ts's doc comment for why. Guard chain mirrors
 * leaderboard/page.tsx and predictions/page.tsx.
 */
export default async function BracketPage() {
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
  const semifinals = matches.filter((m) => m.stage === "semifinal");
  const final = matches.find((m) => m.stage === "final") ?? null;

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[720px]">
      <h1 className="sr-only">{nav.bracket}</h1>
      <SubTabs />

      {semifinals.length === 0 && !final ? (
        <EmptyState message={content.tbd} />
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <div className="flex flex-1 flex-col gap-2">
            <SectionHeader title={content.semiFinal} />
            <div className="flex flex-col gap-4 md:h-full md:justify-between">
              {semifinals.map((match, index) => (
                <MotionIn key={match.id} index={index}>
                  <MatchCard match={match} />
                </MotionIn>
              ))}
            </div>
          </div>

          <div
            aria-hidden
            className="hidden h-px w-8 shrink-0 md:block"
            style={{ background: colors.border }}
          />

          {final && (
            <div className="flex flex-1 flex-col gap-2 md:max-w-[300px]">
              <SectionHeader title={content.final} />
              <MotionIn index={semifinals.length}>
                <MatchCard match={final} />
              </MotionIn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
