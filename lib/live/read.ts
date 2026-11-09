import { footballName } from "@/lib/content/football-names";
import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { CurrentParticipant } from "@/lib/tournaments/current";
import type { LiveDetails, LiveView, LiveGame, LiveChange } from "./types";
import { getLiveAccess } from "./access";
import { allowsRetrospectiveEntry } from "@/lib/tournaments/onboarding";
import { projectStandings, type ProjectionPick } from "./projection";
import { scoreMatchPrediction } from "@/lib/scoring/match-scoring";
import { liveFresh } from "./changes";
export async function readLiveView(
  client: Awaited<ReturnType<typeof createClient>>,
  current: CurrentParticipant,
): Promise<LiveView> {
  const now = Date.now(),
    since = new Date(now - 8 * 3600000).toISOString();
  const [cup, totals, scoring, matches, teams, events, access] =
    await Promise.all([
      client
        .from("tournaments")
        .select("name,onboarding_open,onboarding_matchday")
        .eq("id", current.tournamentId)
        .single(),
      client.rpc("live_score_totals", {
        p_tournament_id: current.tournamentId,
      }),
      client
        .from("scoring_rules")
        .select(
          "exact_score_points,winner_and_diff_points,winner_only_points,wrong_points",
        )
        .eq("tournament_id", current.tournamentId)
        .order("version", { ascending: false })
        .limit(1)
        .single(),
      client
        .from("matches")
        .select(
          "id,status,kickoff,lock_time,home_team_id,away_team_id,live_score,regular_result,extra_time_result,live_details,last_synced_at,normalization_status,stage,matchday",
        )
        .eq("tournament_id", current.tournamentId)
        .or(`status.eq.live,kickoff.gte.${since}`)
        .order("kickoff")
        .limit(60),
      client
        .from("teams")
        .select("id,short_name")
        .eq("tournament_id", current.tournamentId),
      client
        .from("live_match_events")
        .select("id,match_id,change,description,created_at")
        .eq("tournament_id", current.tournamentId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20),
      getLiveAccess(current.tournamentId),
    ]);
  if (
    cup.error ||
    totals.error ||
    scoring.error ||
    matches.error ||
    teams.error ||
    events.error
  )
    throw new Error("לא ניתן לטעון את עדכוני המשחקים כרגע. נסו לרענן.");
  const rules = {
    exactScorePoints: scoring.data.exact_score_points,
    winnerAndDiffPoints: scoring.data.winner_and_diff_points,
    winnerOnlyPoints: scoring.data.winner_only_points,
    wrongPoints: scoring.data.wrong_points,
  };
  const upcoming = (matches.data ?? [])
    .filter((m) => m.status === "scheduled")
    .slice(0, 3);
  const selected = (matches.data ?? []).filter(
    (m) =>
      m.status === "live" ||
      m.status === "finished" ||
      upcoming.some((next) => next.id === m.id),
  );
  const eligible = selected.filter(
    (m) =>
      m.status === "live" &&
      !allowsRetrospectiveEntry(cup.data, m) &&
      Date.parse(m.lock_time) <= now,
  );
  const pickResult = eligible.length
    ? await client
        .from("match_predictions")
        .select(
          "match_id,participant_id,predicted_home,predicted_away,is_default,points_earned",
        )
        .in(
          "match_id",
          eligible.map((m) => m.id),
        )
    : { data: [], error: null };
  if (pickResult.error) throw new Error("לא ניתן לחשב את הטבלה הזמנית כרגע.");
  const picks: ProjectionPick[] = (pickResult.data ?? []).map((p) => ({
    matchId: p.match_id,
    participantId: p.participant_id,
    home: p.predicted_home,
    away: p.predicted_away,
    points: p.points_earned,
  }));
  const projection = projectStandings(
    (totals.data ?? []).map(
      (p: {
        participant_id: string;
        display_name: string;
        match_points: number;
        group_ranking_points: number;
        bonus_points: number;
      }) => ({
        participantId: p.participant_id,
        name: p.display_name,
        matchPoints: p.match_points,
        groupRankingPoints: p.group_ranking_points,
        bonusPoints: p.bonus_points,
      }),
    ),
    selected.map((m) => ({
      id: m.id,
      status: m.status,
      regulationScore:
        (m.live_details as LiveDetails | null)?.regulationScore ?? null,
      locked: eligible.some((e) => e.id === m.id),
      fresh: liveFresh(m.last_synced_at, now, access),
      normalized: m.normalization_status === "normalized",
    })),
    picks,
    rules,
  );
  const games: LiveGame[] = selected.map((m) => {
    const details = m.live_details as LiveDetails | null;
    const retrospective = allowsRetrospectiveEntry(cup.data, m);
    const fresh = liveFresh(m.last_synced_at, now, access);
    const pick = pickResult.data?.find(
      (p) => p.match_id === m.id && p.participant_id === current.participantId,
    );
    const preview =
      m.status === "live" &&
      details?.regulationScore &&
      fresh &&
      !retrospective &&
      Date.parse(m.lock_time) <= now &&
      m.normalization_status === "normalized"
        ? scoreMatchPrediction(
            details.regulationScore,
            {
              home: pick?.predicted_home ?? 0,
              away: pick?.predicted_away ?? 0,
            },
            rules,
          )
        : null;
    return {
      id: m.id,
      home: footballName(
        teams.data?.find((t) => t.id === m.home_team_id)?.short_name ?? "בית",
      ),
      away: footballName(
        teams.data?.find((t) => t.id === m.away_team_id)?.short_name ?? "חוץ",
      ),
      kickoff: m.kickoff,
      status: m.status,
      score:
        m.status === "finished"
          ? (m.extra_time_result ?? m.regular_result)
          : m.live_score,
      details,
      syncedAt: m.last_synced_at,
      retrospective,
      ownPrediction: eligible.some((e) => e.id === m.id)
        ? {
            home: pick?.predicted_home ?? 0,
            away: pick?.predicted_away ?? 0,
            isDefault: !pick || pick.is_default,
          }
        : null,
      temporaryPoints: preview?.points ?? null,
      temporaryOutcome: preview?.outcome ?? null,
      stale: m.status === "live" && !fresh,
    };
  });
  return {
    tournamentId: current.tournamentId,
    tournamentName: cup.data.name,
    selfId: current.participantId,
    access,
    generatedAt: new Date(now).toISOString(),
    ...projection,
    games,
    events: (events.data ?? []).map((e) => ({
      id: e.id,
      matchId: e.match_id,
      kind: (e.change as LiveChange).kind,
      description: e.description,
      createdAt: e.created_at,
    })),
  };
}
