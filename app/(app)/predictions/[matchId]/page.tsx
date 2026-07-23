import Link from "next/link";
import { notFound } from "next/navigation";
import {
  matchDetail as content,
  predictions as predictionsContent,
  scoring,
} from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import { createClient } from "@/lib/supabase/server";
import { isPast } from "@/lib/time";
import { Card, Pill } from "@/app/_components/ui";
import { PredictionForm } from "./_components/prediction-form";

type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";
type Score = { home: number; away: number };
type PredictionOutcome =
  | "exact"
  | "winner_diff"
  | "winner"
  | "draw_correct"
  | "wrong";

type MatchRow = {
  id: string;
  tournament_id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff: string;
  lock_time: string;
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

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
        "id, tournament_id, home_team_id, away_team_id, kickoff, lock_time, status, regular_result, live_score",
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

  const homeTeam = teams?.find((t) => t.id === match.home_team_id) ?? null;
  const awayTeam = teams?.find((t) => t.id === match.away_team_id) ?? null;

  let prediction: PredictionRow | null = null;
  if (participant) {
    const { data } = await supabase
      .from("match_predictions")
      .select("predicted_home, predicted_away, points_earned, outcome")
      .eq("match_id", matchId)
      .eq("participant_id", participant.id)
      .maybeSingle<PredictionRow>();
    prediction = data ?? null;
  }

  const isLocked = isPast(match.lock_time);
  const canEdit = !isLocked && match.status === "scheduled";
  const score =
    match.status === "finished"
      ? match.regular_result
      : match.status === "live"
        ? match.live_score
        : null;

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[480px]">
      <Link
        href="/predictions"
        className="text-xs font-semibold text-[var(--text-muted)]"
      >
        {`< ${content.backToPredictions}`}
      </Link>

      <Card padding="hero" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--text-muted)]">
            {formatKickoff(match.kickoff)}
          </span>
          <StatusPill status={match.status} isLocked={isLocked} />
        </div>

        <div className="flex items-center gap-3">
          <span className="flex-1 text-end text-base font-extrabold text-[var(--text-primary)]">
            {homeTeam?.short_name ?? content.homeLabel}
          </span>
          {score ? (
            <span className="ltr shrink-0 px-2 text-2xl font-black text-[var(--text-primary)] tabular-nums">
              {score.home} – {score.away}
            </span>
          ) : (
            <span className="shrink-0 px-2 text-sm font-bold text-[var(--text-muted)]">
              {"–"}
            </span>
          )}
          <span className="flex-1 text-start text-base font-extrabold text-[var(--text-primary)]">
            {awayTeam?.short_name ?? content.awayLabel}
          </span>
        </div>

        {canEdit ? (
          <PredictionForm
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
                <span className="ltr text-lg font-black tabular-nums text-[var(--text-primary)]">
                  {prediction.predicted_home} – {prediction.predicted_away}
                </span>
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
    </div>
  );
}
