import { footballName } from "@/lib/content/football-names";
import { WelcomeNudge } from "@/app/_components/welcome-nudge";
import { home as content } from "@/lib/content/he";
import {
  computeStandings,
  type StandingsInput,
} from "@/lib/scoring/leaderboard";
import { computePredictionStreaks } from "@/lib/scoring/streaks";
import { listTournamentMatches, type MatchWithTeams } from "@/lib/matches/list";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { EmptyState } from "../_components/ui";
import { HomeDashboard } from "../_components/home/dashboard";
import { focusMatches, roundProgress } from "@/lib/matches/progress";
import { readSummaries } from "@/lib/notifications/summaries";
import { currentTimeMs } from "@/lib/time";

type ParticipantRow = {
  id: string;
  display_name: string;
  avatar_initials: string | null;
};
type SnapshotRow = {
  participant_id: string;
  rank: number;
  total_points: number;
  match_points: number;
  group_ranking_points: number;
  bonus_points: number;
  captured_at: string;
};
type BonusCategoryRow = { id: string; name: string; sort_order: number };
type BonusStatRow = { category_id: string; label: string; value: number };

/** Same batching approach as leaderboard/page.tsx: every row from one
 * snapshot capture shares an identical `captured_at`, so grouping by that
 * timestamp recovers each historical batch without a separate table. */
function groupIntoBatches(rows: SnapshotRow[]): SnapshotRow[][] {
  const byTimestamp = new Map<number, SnapshotRow[]>();
  for (const row of rows) {
    const key = new Date(row.captured_at).getTime();
    const batch = byTimestamp.get(key);
    if (batch) batch.push(row);
    else byTimestamp.set(key, [row]);
  }
  return [...byTimestamp.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, batch]) => batch);
}

export const dynamic = "force-dynamic";

/**
 * Screen 1 (UX-BLUEPRINT.md): rank hero, achievements, next/latest match,
 * leaderboard preview, tournament (bonus) leaders, recent results.
 *
 * Real-data pass (ROADMAP.md Phase 9 gap-fill, predates the phase itself) —
 * this screen ran entirely on `@/lib/mock` fixtures through Phases 2-8, see
 * lib/matches/list.ts's doc comment for why. Guard chain and standings
 * computation mirror leaderboard/page.tsx exactly (same
 * `getCurrentParticipant` MVP stand-in, same `computeStandings` recompute
 * rather than trusting a possibly-stale snapshot's stored rank).
 *
 * Two cards that had no real backing data model at all were dropped rather
 * than left fabricated: the mock "3 exact predictions in a row" badge never
 * actually reflected the mock participant's data (a static string regardless
 * of input) — replaced with a real `exactStreak` computed from the caller's
 * own scored `match_predictions.outcome` history (lib/scoring/streaks.ts).
 * The mock "activity feed" had per-participant narrative text
 * ("X קלע בול...") with no backing table anywhere in DATABASE.md — building
 * that is a real feature (a social/audit feed), not a wiring task, so it's
 * replaced here with the tournament's actual most-recent finished results,
 * which *is* real data already on hand from `listTournamentMatches`.
 */
export default async function HomePage() {
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
  const { tournamentId, participantId: selfId } = current;

  const [
    { data: participants, error: participantsError },
    { data: snapshotRows, error: snapshotsError },
    matches,
    { data: categories },
    { data: tournament, error: tournamentError },

    { count: bonusTotal, error: slotsError },
    { count: bonusSaved, error: bonusError },
    { count: rankingSaved, error: rankingError },
    { data: groupTeams, error: teamsError },
    [latestDigest],
  ] = await Promise.all([
    supabase
      .from("participants")
      .select("id, display_name, avatar_initials")
      .eq("tournament_id", tournamentId)
      .returns<ParticipantRow[]>(),
    supabase
      .from("leaderboard_snapshots")
      .select(
        "participant_id, rank, total_points, match_points, group_ranking_points, bonus_points, captured_at",
      )
      .eq("tournament_id", tournamentId)
      .returns<SnapshotRow[]>(),
    listTournamentMatches(supabase, tournamentId, selfId),
    supabase
      .from("bonus_categories")
      .select("id, name, sort_order")
      .eq("tournament_id", tournamentId)
      .order("sort_order", { ascending: true })
      .returns<BonusCategoryRow[]>(),
    supabase
      .from("tournaments")
      .select("name, onboarding_open")
      .eq("id", tournamentId)
      .single(),
    supabase
      .from("bonus_slots")
      .select("id, bonus_categories!inner(tournament_id)", {
        count: "exact",
        head: true,
      })
      .eq("bonus_categories.tournament_id", tournamentId),
    supabase
      .from("bonus_predictions")
      .select("slot_id", { count: "exact", head: true })
      .eq("participant_id", selfId),
    supabase
      .from("group_predictions")
      .select("group", { count: "exact", head: true })
      .eq("participant_id", selfId)
      .eq("tournament_id", tournamentId),
    supabase
      .from("teams")
      .select("group")
      .eq("tournament_id", tournamentId)
      .not("group", "is", null),
    readSummaries(tournamentId, 1),
  ]);

  if (participantsError || snapshotsError) {
    throw new Error(
      "לא ניתן לטעון את הדירוג כרגע. נסו שוב — הנקודות שלכם נשמרו.",
    );
  }

  const topCategories = (categories ?? []).slice(0, 3);
  const { data: leaderRows } =
    topCategories.length > 0
      ? await supabase
          .from("bonus_stats")
          .select("category_id, label, value")
          .in(
            "category_id",
            topCategories.map((c) => c.id),
          )
          .eq("rank", 1)
          .returns<BonusStatRow[]>()
      : { data: null as BonusStatRow[] | null };

  const self = (participants ?? []).find((p) => p.id === selfId);

  // Standings recomputed the same way as leaderboard/page.tsx (see its doc
  // comment) rather than trusted off the latest snapshot's stored fields.
  const batches = groupIntoBatches(snapshotRows ?? []);
  const latestBatch = batches[0] ?? [];
  const previousBatch = batches[1] ?? [];
  const latestByParticipant = new Map(
    latestBatch.map((r) => [r.participant_id, r]),
  );
  const previousRankByParticipant = new Map(
    previousBatch.map((r) => [r.participant_id, r.rank]),
  );
  const standingsInput: StandingsInput[] = (participants ?? []).map((p) => {
    const latest = latestByParticipant.get(p.id);
    return {
      participantId: p.id,
      matchPoints: latest?.match_points ?? 0,
      groupRankingPoints: latest?.group_ranking_points ?? 0,
      bonusPoints: latest?.bonus_points ?? 0,
    };
  });
  const standings = computeStandings(standingsInput);
  const selfStanding = standings.find((s) => s.participantId === selfId);
  const selfRank = selfStanding?.rank ?? 0;
  const selfPreviousRank = previousRankByParticipant.get(selfId) ?? selfRank;
  const rankMoved = selfPreviousRank - selfRank;

  const participantById = new Map((participants ?? []).map((p) => [p.id, p]));
  const topThree = [...standings]
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (
          participantById.get(a.participantId)?.display_name ?? ""
        ).localeCompare(
          participantById.get(b.participantId)?.display_name ?? "",
        ),
    )
    .slice(0, 3);

  const nextMatch: MatchWithTeams | null =
    matches.find((m) => m.status === "scheduled" || m.status === "live") ??
    null;
  const finishedMatches = matches.filter((m) => m.status === "finished");
  const latestFinished: MatchWithTeams | null =
    [...finishedMatches].sort(
      (a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime(),
    )[0] ?? null;
  const recentResults = [...finishedMatches]
    .sort(
      (a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime(),
    )
    .slice(0, 4);

  const { exactStreak, correctStreak, accuracyPercent } =
    computePredictionStreaks(
      matches
        .filter((m) => m.ownPrediction !== null)
        .map((m) => ({
          kickoff: m.kickoff,
          outcome: m.ownPrediction!.outcome,
        })),
    );

  const now = currentTimeMs();
  const entryMatches = focusMatches(matches, now);
  const round = roundProgress(entryMatches, now);

  const progressAvailable =
    !tournamentError &&
    !slotsError &&
    !bonusError &&
    !rankingError &&
    !teamsError;
  const rankingTotal = new Set((groupTeams ?? []).map((team) => team.group))
    .size;

  return (
    <>
      <WelcomeNudge key={selfId} scope={`${tournamentId}:${selfId}`} />
      <HomeDashboard
        name={self?.display_name ?? ""}
        tournamentName={tournament?.name ?? "הליגה שלנו"}
        onboardingOpen={tournament?.onboarding_open === true}
        rank={selfRank}
        points={selfStanding?.totalPoints ?? 0}
        rankMoved={rankMoved}
        raceEntries={standings.map((p) => ({
          id: p.participantId,
          name: participantById.get(p.participantId)?.display_name ?? "משתתף",
          rank: p.rank,
          total: p.totalPoints,
        }))}
        selfId={selfId}
        roundLabel={
          entryMatches[0]?.matchday
            ? `מחזור ${entryMatches[0].matchday}`
            : "המשחקים הקרובים"
        }
        missingCount={round.missing.length}
        deadline={round.deadline}
        retrospective={round.retrospective}
        latestSummary={
          latestDigest
            ? {
                day: latestDigest.day,
                count: latestDigest.standings?.length ?? 0,
              }
            : null
        }
        participantCount={standings.length}
        progress={
          progressAvailable
            ? {
                matchesSaved: round.saved,
                matchesTotal: round.total,
                bonusSaved: bonusSaved ?? 0,
                bonusTotal: bonusTotal ?? 0,
                rankingSaved: rankingSaved ?? 0,
                rankingTotal,
              }
            : null
        }
        predictionHref={"/predictions"}
        nextMatch={
          matches.find((match) => match.status === "live") ?? nextMatch
        }
        latestFinished={latestFinished}
        leaders={topThree.map((entry) => ({
          id: entry.participantId,
          name:
            participantById.get(entry.participantId)?.display_name ?? "משתתף",
          initials:
            participantById.get(entry.participantId)?.avatar_initials ||
            participantById
              .get(entry.participantId)
              ?.display_name?.trim()
              .slice(0, 2) ||
            "?",
          rank: entry.rank,
          points: entry.totalPoints,
          self: entry.participantId === selfId,
        }))}
        recentResults={recentResults}
        bonusLeaders={topCategories.flatMap((category) => {
          const leader = (leaderRows ?? []).find(
            (row) => row.category_id === category.id,
          );
          return leader
            ? [{ category: category.name, name: footballName(leader.label) }]
            : [];
        })}
        exactStreak={exactStreak}
        correctStreak={correctStreak}
        accuracyPercent={accuracyPercent}
      />
    </>
  );
}
