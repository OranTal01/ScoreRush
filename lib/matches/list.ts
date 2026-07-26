/**
 * Shared real-data matches query (ROADMAP.md Phase 9 gap-fill, predates the
 * phase itself): backs the home dashboard, predictions list, and bracket
 * screens — the three screens that render `MatchCard`. All three ran on
 * `@/lib/mock` fixtures through Phases 2-8 (predictions/[matchId]/page.tsx's
 * own doc comment explicitly deferred this: "the predictions list screen
 * itself stays on mock data until a later real-data pass over the
 * read-only/browse screens"). This module is that pass, factored out once
 * rather than duplicated three times.
 *
 * Reads go through the session-bound, RLS-scoped client (same as
 * predictions/[matchId]/page.tsx and leaderboard/page.tsx) rather than the
 * service-role Drizzle client — `matches`/`teams` are members-only
 * (DATABASE.md §5) and `match_predictions` is filtered to the caller's own
 * `participantId` here, which RLS also independently enforces.
 */
import "server-only";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";
export type MatchScore = { home: number; away: number };

export interface MatchTeam {
  id: string;
  name: string;
  shortName: string;
  /** Null when no flag asset has been set (e.g. manually-entered teams) — never fabricated. */
  flagAssetUrl: string | null;
}

export type PredictionOutcome =
  | "exact"
  | "winner_diff"
  | "winner"
  | "draw_correct"
  | "wrong";

export interface MatchOwnPrediction {
  predictedHome: number;
  predictedAway: number;
  pointsEarned: number | null;
  /** Null until the match is scored (lib/db/schema/enums.ts predictionOutcomeEnum). */
  outcome: PredictionOutcome | null;
}

export interface MatchWithTeams {
  id: string;
  tournamentId: string;
  /** Free text (e.g. "group", "semifinal", "final") — DATABASE.md §3 / ARCHITECTURE.md §6. */
  stage: string;
  group: string | null;
  matchday: number | null;
  kickoff: string;
  lockTime: string;
  status: MatchStatus;
  regularResult: MatchScore | null;
  liveScore: MatchScore | null;
  /** Null only if the referenced team row is somehow missing — never expected in practice (FK NOT NULL). */
  homeTeam: MatchTeam | null;
  awayTeam: MatchTeam | null;
  /** The caller's own prediction for this match, if any. Always null when `participantId` is null. */
  ownPrediction: MatchOwnPrediction | null;
}

type MatchRow = {
  id: string;
  tournament_id: string;
  stage: string;
  group: string | null;
  matchday: number | null;
  home_team_id: string;
  away_team_id: string;
  kickoff: string;
  lock_time: string;
  status: MatchStatus;
  regular_result: MatchScore | null;
  live_score: MatchScore | null;
};
type TeamRow = {
  id: string;
  name: string;
  short_name: string;
  flag_asset_url: string | null;
};
type PredictionRow = {
  match_id: string;
  predicted_home: number;
  predicted_away: number;
  points_earned: number | null;
  outcome: PredictionOutcome | null;
};

/** All of a tournament's matches, kickoff-ascending, with resolved teams and
 * (when `participantId` is given) the caller's own prediction per match. */
export async function listTournamentMatches(
  supabase: SupabaseServerClient,
  tournamentId: string,
  participantId: string | null,
): Promise<MatchWithTeams[]> {
  const { data: matchRows } = await supabase
    .from("matches")
    .select(
      "id, tournament_id, stage, group, matchday, home_team_id, away_team_id, kickoff, lock_time, status, regular_result, live_score",
    )
    .eq("tournament_id", tournamentId)
    .order("kickoff", { ascending: true })
    .returns<MatchRow[]>();

  const matches = matchRows ?? [];
  if (matches.length === 0) return [];

  const teamIds = [...new Set(matches.flatMap((m) => [m.home_team_id, m.away_team_id]))];
  const matchIds = matches.map((m) => m.id);

  const [{ data: teamRows }, { data: predictionRows }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, short_name, flag_asset_url")
      .in("id", teamIds)
      .returns<TeamRow[]>(),
    participantId
      ? supabase
          .from("match_predictions")
          .select("match_id, predicted_home, predicted_away, points_earned, outcome")
          .eq("participant_id", participantId)
          .in("match_id", matchIds)
          .returns<PredictionRow[]>()
      : Promise.resolve({ data: null as PredictionRow[] | null }),
  ]);

  const teamById = new Map((teamRows ?? []).map((t) => [t.id, t]));
  const predictionByMatchId = new Map((predictionRows ?? []).map((p) => [p.match_id, p]));

  const toTeam = (row: TeamRow | undefined): MatchTeam | null =>
    row
      ? {
          id: row.id,
          name: row.name,
          shortName: row.short_name,
          flagAssetUrl: row.flag_asset_url,
        }
      : null;

  return matches.map((m) => {
    const prediction = predictionByMatchId.get(m.id);
    return {
      id: m.id,
      tournamentId: m.tournament_id,
      stage: m.stage,
      group: m.group,
      matchday: m.matchday,
      kickoff: m.kickoff,
      lockTime: m.lock_time,
      status: m.status,
      regularResult: m.regular_result,
      liveScore: m.live_score,
      homeTeam: toTeam(teamById.get(m.home_team_id)),
      awayTeam: toTeam(teamById.get(m.away_team_id)),
      ownPrediction: prediction
        ? {
            predictedHome: prediction.predicted_home,
            predictedAway: prediction.predicted_away,
            pointsEarned: prediction.points_earned,
            outcome: prediction.outcome,
          }
        : null,
    };
  });
}
