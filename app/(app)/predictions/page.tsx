import { LiveLink } from "@/app/_components/live-link";
import { predictions as content } from "@/lib/content/he";
import { listTournamentMatches } from "@/lib/matches/list";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { MatchesBrowser } from "../../_components/matches-browser";
import { SubTabs } from "../../_components/nav/sub-tabs";
import { EmptyState } from "../../_components/ui";

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

  const [matches, { data: tournament, error: tournamentError }] =
    await Promise.all([
      listTournamentMatches(
        supabase,
        current.tournamentId,
        current.participantId,
      ),
      supabase
        .from("tournaments")
        .select("match_lock_minutes, onboarding_matchday, onboarding_closes_at")
        .eq("id", current.tournamentId)
        .single(),
    ]);
  if (tournamentError || !tournament)
    throw new Error("לא ניתן לטעון את מועד הנעילה");
  const lockLabel =
    tournament.match_lock_minutes === 1
      ? "דקה"
      : `${tournament.match_lock_minutes} דקות`;

  const onboarding = matches.some((match) => match.retrospectiveEntry);
  const onboardingRounds =
    tournament.onboarding_matchday === 1
      ? "מחזור 1"
      : `מחזורים 1–${tournament.onboarding_matchday}`;
  const onboardingDeadline = tournament.onboarding_closes_at
    ? new Intl.DateTimeFormat("he-IL", {
        timeZone: "Asia/Jerusalem",
        day: "numeric",
        month: "numeric",
      }).format(new Date(Date.parse(tournament.onboarding_closes_at) - 1))
    : null;
  return (
    <div className="mx-auto flex w-full max-w-[960px] min-w-0 flex-col gap-5">
      <header>
        <h1 className="page-heading">המשחקים והניחושים</h1>
        <p className="page-intro mt-2">
          המחזור שלכם, במקום אחד. ממלאים, שומרים ונכנסים למרוץ.
        </p>
      </header>
      <SubTabs />
      {onboarding ? (
        <p className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/5 p-4 text-xs leading-6 text-[var(--text-secondary)]">
          <strong className="text-[var(--gold)]">תקופת הקליטה פתוחה.</strong> זו
          הזדמנות אחרונה להשלים ניחושים חסרים ב{onboardingRounds}. ניחוש שכבר
          נשמר נשאר נעול ולא ניתן לשינוי
          {onboardingDeadline ? ` עד סוף ${onboardingDeadline}.` : "."}
        </p>
      ) : null}
      <p className="text-xs leading-6 text-[var(--text-secondary)]">
        משחקים עתידיים: אפשר לערוך עד {lockLabel} לפני הפתיחה. ללא ניחוש ייחשב
        0–0. הניקוד לפי 90 דקות ותוספת זמן, ללא הארכה ופנדלים.
      </p>
      <LiveLink />
      <MatchesBrowser
        key={current.participantId}
        matches={matches}
        draftScope={`${current.tournamentId}:${current.participantId}`}
      />
    </div>
  );
}
