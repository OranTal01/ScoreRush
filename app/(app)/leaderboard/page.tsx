import { leaderboard as content } from "@/lib/content/he";
import { computeStandings, type StandingsInput } from "@/lib/scoring/leaderboard";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { Podium } from "../../_components/leaderboard/podium";
import { PointsBreakdown } from "../../_components/leaderboard/points-breakdown";
import { RankRow } from "../../_components/leaderboard/rank-row";
import type { LeaderboardParticipant } from "../../_components/leaderboard/types";
import { Card, EmptyState, SectionHeader } from "../../_components/ui";

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

/** Groups snapshot rows by their exact `captured_at` timestamp (every row from
 * one capture shares an identical value — see lib/scoring/snapshots.ts's doc
 * comment) and returns the batches ordered newest-first. */
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

/** Screen 8 (UX-BLUEPRINT.md): full ranked list + podium, own-row highlight,
 * rank movement indicators — wired to real data via RLS-scoped queries.
 * `getCurrentParticipant` (lib/tournaments/current.ts) picks the caller's
 * most-recently-joined tournament — a documented MVP stand-in until the real
 * tournament switcher exists.
 *
 * Standings are recomputed here via `computeStandings` (not read directly
 * off the latest snapshot's stored `rank`/`total_points`) so a participant
 * who joined after the last cron capture — and so has no snapshot row yet —
 * is still ranked correctly alongside everyone else, at zero points, through
 * the exact same identity-enforcing function the snapshot pipeline itself
 * uses (SCORING-RULES.md §9). Rank *movement* does read the previous
 * batch's stored rank directly, since that's the one thing this screen
 * can't recompute — it's history. */
export default async function LeaderboardPage() {
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

  const [{ data: participants }, { data: snapshotRows }] = await Promise.all([
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
  ]);

  if (!participants || participants.length === 0) {
    return <EmptyState message={content.emptyState} />;
  }

  const batches = groupIntoBatches(snapshotRows ?? []);
  const latestBatch = batches[0] ?? [];
  const previousBatch = batches[1] ?? [];

  const latestByParticipant = new Map(latestBatch.map((r) => [r.participant_id, r]));
  const previousRankByParticipant = new Map(
    previousBatch.map((r) => [r.participant_id, r.rank]),
  );

  const standingsInput: StandingsInput[] = participants.map((p) => {
    const latest = latestByParticipant.get(p.id);
    return {
      participantId: p.id,
      matchPoints: latest?.match_points ?? 0,
      groupRankingPoints: latest?.group_ranking_points ?? 0,
      bonusPoints: latest?.bonus_points ?? 0,
    };
  });
  const standings = computeStandings(standingsInput);

  const participantById = new Map(participants.map((p) => [p.id, p]));
  const rows: LeaderboardParticipant[] = standings.map((entry) => {
    const participant = participantById.get(entry.participantId);
    return {
      id: entry.participantId,
      displayName: participant?.display_name ?? entry.participantId,
      avatarInitials: participant?.avatar_initials ?? "?",
      totalPoints: entry.totalPoints,
      matchPoints: entry.matchPoints,
      groupRankingPoints: entry.groupRankingPoints,
      bonusPoints: entry.bonusPoints,
      rank: entry.rank,
      // No prior batch to compare against yet -> no movement ("–").
      previousRank: previousRankByParticipant.get(entry.participantId) ?? entry.rank,
    };
  });

  const sorted = [...rows].sort(
    (a, b) => a.rank - b.rank || a.displayName.localeCompare(b.displayName),
  );
  const topThree = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[560px] lg:max-w-[640px]">
      <Card className="flex flex-col gap-4">
        <SectionHeader title={content.podiumTitle} />
        <Podium topThree={topThree} selfId={selfId} />
      </Card>

      <Card className="flex flex-col gap-1">
        <SectionHeader title={content.title} />
        <ol className="flex flex-col gap-1">
          {rest.map((participant, index) => (
            <RankRow
              key={participant.id}
              participant={participant}
              selfId={selfId}
              index={index}
            />
          ))}
        </ol>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.breakdownTitle} />
        <PointsBreakdown participants={sorted} selfId={selfId} />
      </Card>
    </div>
  );
}
