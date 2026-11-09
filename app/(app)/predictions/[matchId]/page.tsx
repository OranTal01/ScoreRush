import { footballName } from "@/lib/content/football-names";
import Link from "next/link";
import { readFriendsPredictions } from "@/lib/matches/friends";
import { canRevealPredictions } from "@/lib/matches/reveal";
import { FriendsPredictions } from "@/app/_components/friends-predictions";
import { notFound } from "next/navigation";
import {
  matchDetail as content,
  predictions as predictionsContent,
  scoring,
} from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import { createClient } from "@/lib/supabase/server";
import {
  allowsRetrospectiveEntry,
  type OnboardingSettings,
} from "@/lib/tournaments/onboarding";
import { currentTimeMs, formatMatchTime, isPast } from "@/lib/time";
import { Card, Pill } from "@/app/_components/ui";
import { PredictionForm } from "./_components/prediction-form";
import { ScorePair } from "@/app/_components/score-pair";

type MatchStatus =
  "scheduled" | "live" | "finished" | "postponed" | "cancelled";
type Score = { home: number; away: number };
type PredictionOutcome =
  "exact" | "winner_diff" | "winner" | "draw_correct" | "wrong";

type MatchRow = {
  id: string;
  tournament_id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff: string;
  lock_time: string;
  matchday: number | null;
  stage: string;
  tournaments: OnboardingSettings | null;
  status: MatchStatus;
  regular_result: Score | null;
  live_score: Score | null;
};

type TeamRow = {
  id: string;
  name: string;
  short_name: string;
};

type PredictionRow = {
  is_default: boolean;
  predicted_home: number;
  predicted_away: number;
  points_earned: number | null;
  outcome: PredictionOutcome | null;
};

const OUTCOME_LABEL: Record<PredictionOutcome, string> = {
  exact: scoring.exactScore,
  winner_diff: scoring.winnerAndDifference,
  winner: scoring.winnerOnly,
  draw_correct: scoring.correctDraw,
  wrong: scoring.wrongPrediction,
};

function StatusPill({
  status,
  isLocked,
}: {
  status: MatchStatus;
  isLocked: boolean;
}) {
  if (status === "live") {
    return (
      <Pill tone="danger" pulse>
        {predictionsContent.liveLabel}
      </Pill>
    );
  }
  if (status === "finished") {
    return <Pill tone="muted">{predictionsContent.finishedLabel}</Pill>;
  }
  return (
    <Pill tone={isLocked ? "muted" : "interactive"}>
      {isLocked ? predictionsContent.lockedLabel : predictionsContent.openLabel}
    </Pill>
  );
}

/**
 * Screen 6 (UX-BLUEPRINT.md §3): score controls, lock status, and — once
 * resolved — the scoring explanation. First real-data-backed prediction
 * *entry* surface (ROADMAP.md Phase 5); the predictions list screen itself
 * stays on mock data until a later real-data pass over the read-only/browse
 * screens.
 *
 * Reads go through the session-bound, RLS-scoped client (lib/supabase/server.ts)
 * rather than the service-role Drizzle client — RLS is what actually decides
 * what a participant can see (own prediction always, others' only after
 * lock), so this page must observe the same policy the write path does.
 */
export const dynamic = "force-dynamic";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const supabase = await createClient();

  const [{ data: match }, { data: userData }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, tournament_id, home_team_id, away_team_id, kickoff, lock_time, status, regular_result, live_score, stage, matchday, tournaments(onboarding_open, onboarding_matchday, onboarding_closes_at)",
      )
      .eq("id", matchId)
      .maybeSingle<MatchRow>(),
    supabase.auth.getUser(),
  ]);

  if (!match) {
    notFound();
  }

  const user = userData.user;

  const [{ data: teams }, { data: participant }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, short_name")
      .in("id", [match.home_team_id, match.away_team_id])
      .returns<TeamRow[]>(),
    user
      ? supabase
          .from("participants")
          .select("id")
          .eq("tournament_id", match.tournament_id)
          .eq("user_id", user.id)
          .maybeSingle<{ id: string }>()
      : Promise.resolve({ data: null as { id: string } | null }),
  ]);

  const displayTeams = teams?.map((t) => ({
    ...t,
    name: footballName(t.name),
    short_name: footballName(t.short_name),
  }));
  const homeTeam =
    displayTeams?.find((t) => t.id === match.home_team_id) ?? null;
  const awayTeam =
    displayTeams?.find((t) => t.id === match.away_team_id) ?? null;

  let prediction: PredictionRow | null = null;
  if (participant) {
    const { data } = await supabase
      .from("match_predictions")
      .select(
        "predicted_home, predicted_away, points_earned, outcome, is_default",
      )
      .eq("match_id", matchId)
      .eq("participant_id", participant.id)
      .maybeSingle<PredictionRow>();
    prediction = data ?? null;
  }

  const retrospective = allowsRetrospectiveEntry(match.tournaments, match);
  const retrospectiveDeadline = match.tournaments?.onboarding_closes_at
    ? new Intl.DateTimeFormat("he-IL", {
        timeZone: "Asia/Jerusalem",
        day: "numeric",
        month: "numeric",
      }).format(
        new Date(
          Date.parse(String(match.tournaments.onboarding_closes_at)) - 1,
        ),
      )
    : null;
  const isLocked = isPast(match.lock_time) && !retrospective;
  const alreadySubmittedRetrospectively =
    retrospective &&
    isPast(match.lock_time) &&
    !!prediction &&
    !prediction.is_default;
  const canEdit =
    !!participant &&
    !alreadySubmittedRetrospectively &&
    !["cancelled", "postponed"].includes(match.status) &&
    (retrospective || (!isLocked && match.status === "scheduled"));
  const friends =
    participant &&
    canRevealPredictions(
      match.status,
      match.lock_time,
      retrospective,
      currentTimeMs(),
    )
      ? await readFriendsPredictions(supabase, matchId, match.tournament_id)
      : null;
  const score =
    match.status === "finished"
      ? match.regular_result
      : match.status === "live"
        ? match.live_score
        : null;

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[480px]">
      <h1 className="sr-only">{content.title}</h1>
      <Link
        href="/predictions"
        className="text-xs font-semibold text-[var(--text-muted)]"
      >
        {`< ${content.backToPredictions}`}
      </Link>

      <Card padding="hero" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--text-muted)]">
            {formatMatchTime(match.kickoff)}
          </span>
          <StatusPill status={match.status} isLocked={isLocked} />
        </div>

        <div dir="rtl" className="flex items-center gap-3">
          <span className="flex-1 text-end text-base font-extrabold text-[var(--text-primary)]">
            {homeTeam?.short_name ?? content.homeLabel}
          </span>
          {score ? (
            <ScorePair
              home={score.home}
              away={score.away}
              homeLabel={homeTeam?.short_name}
              awayLabel={awayTeam?.short_name}
              live={match.status === "live"}
              className="shrink-0 px-2 text-2xl font-black text-[var(--text-primary)]"
            />
          ) : (
            <span className="shrink-0 px-2 text-sm font-bold text-[var(--text-muted)]">
              {"–"}
            </span>
          )}
          <span className="flex-1 text-start text-base font-extrabold text-[var(--text-primary)]">
            {awayTeam?.short_name ?? content.awayLabel}
          </span>
        </div>

        {retrospective && (
          <p className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-sm leading-6">
            הזדמנות אחרונה להשלמה: ניתן למלא רק משחקים שעדיין לא שלחתם. ניחוש
            שנשמר לא ניתן לשינוי.
            {retrospectiveDeadline
              ? ` ההשלמה פתוחה עד סוף ${retrospectiveDeadline}.`
              : null}
          </p>
        )}
        {canEdit ? (
          <PredictionForm
            key={`${participant!.id}:${matchId}`}
            draftScope={`${match.tournament_id}:${participant!.id}`}
            hasSubmitted={!!prediction && !prediction.is_default}
            lockTime={match.lock_time}
            retrospective={retrospective}
            matchId={matchId}
            homeLabel={homeTeam?.short_name ?? content.homeLabel}
            awayLabel={awayTeam?.short_name ?? content.awayLabel}
            initialHome={prediction?.predicted_home ?? 0}
            initialAway={prediction?.predicted_away ?? 0}
          />
        ) : (
          <div
            className="flex flex-col items-center gap-2 border-t pt-3 text-center"
            style={{ borderColor: colors.border }}
          >
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {content.lockedStatic}
            </span>
            {prediction ? (
              <>
                <span className="text-xs text-[var(--text-secondary)]">
                  {content.yourPredictionLabel}
                </span>
                <ScorePair
                  home={prediction.predicted_home}
                  away={prediction.predicted_away}
                  homeLabel={homeTeam?.short_name}
                  awayLabel={awayTeam?.short_name}
                  className="text-lg font-black text-[var(--text-primary)]"
                />
                {prediction.points_earned !== null && (
                  <span className="text-sm font-bold text-[var(--gold)]">
                    {`+${prediction.points_earned} נק'`}
                  </span>
                )}
                {prediction.outcome && (
                  <span className="text-xs text-[var(--text-secondary)]">
                    {OUTCOME_LABEL[prediction.outcome]}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-[var(--text-muted)]">
                {content.noPredictionSubmitted}
              </span>
            )}
          </div>
        )}
      </Card>
      {participant && (
        <FriendsPredictions
          picks={friends}
          selfId={participant.id}
          homeLabel={homeTeam?.short_name ?? content.homeLabel}
          awayLabel={awayTeam?.short_name ?? content.awayLabel}
          retrospective={retrospective}
        />
      )}
    </div>
  );
}
