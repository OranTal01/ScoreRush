/**
 * Leaderboard snapshot capture pipeline (ROADMAP.md Phase 6 task #53).
 * Reads every tournament participant's already-scored match/group/bonus
 * prediction rows (written by recompute.ts), sums each part per participant,
 * and runs the result through `computeStandings` (leaderboard.ts) — the one
 * place SCORING-RULES.md §9's totalPoints identity is computed — before
 * persisting a `leaderboard_snapshots` batch. This is the only code path
 * that writes that table: the RLS migration comment
 * (0001_rls_policies.sql) states snapshots are "written only by the service
 * role (sync/aggregation jobs), which bypasses RLS entirely," so this uses
 * the service-role Drizzle client (`lib/db/client.ts`), the same
 * trusted-backend posture as recompute.ts, not the RLS-scoped Supabase
 * client.
 *
 * Wired into `app/api/cron/sync/route.ts` immediately after
 * `recomputeTournamentScores` for each tournament — new scored points are
 * exactly what should trigger a new snapshot, and only recompute can change
 * `points_earned`, so "run right after recompute" is sufficient without a
 * separate schedule.
 *
 * Skips writing a new batch when the freshly computed standings are
 * identical to the latest stored batch (same rank/points for every
 * participant) — a cron tick with no score changes (the common case between
 * live matchdays) shouldn't grow the table with duplicate rows. "Latest
 * batch" is determined by grouping stored rows by their exact `capturedAt`
 * timestamp: a single `db.insert(...).values([...])` call is one INSERT
 * statement (one transaction), and Postgres's `now()` — what `defaultNow()`
 * resolves to — is stable for the whole transaction, so every row from one
 * capture always shares one identical timestamp.
 */
import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { matches } from "@/lib/db/schema/competition";
import { bonusCategories } from "@/lib/db/schema/config";
import { participants } from "@/lib/db/schema/identity";
import {
  bonusPredictions,
  groupPredictions,
  leaderboardSnapshots,
  matchPredictions,
} from "@/lib/db/schema/predictions";
import { computeStandings, type StandingsEntry, type StandingsInput } from "./leaderboard";

export interface SnapshotResult {
  tournamentId: string;
  /** False when there were no participants, or standings were unchanged from the latest batch. */
  captured: boolean;
  participantsCount: number;
}

export async function captureLeaderboardSnapshot(
  tournamentId: string,
): Promise<SnapshotResult> {
  const tournamentParticipants = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.tournamentId, tournamentId));

  if (tournamentParticipants.length === 0) {
    return { tournamentId, captured: false, participantsCount: 0 };
  }

  const matchPointsByParticipant = await sumMatchPoints(tournamentId);
  const groupPointsByParticipant = await sumGroupPoints(tournamentId);
  const bonusPointsByParticipant = await sumBonusPoints(tournamentId);

  const standingsInput: StandingsInput[] = tournamentParticipants.map((p) => ({
    participantId: p.id,
    matchPoints: matchPointsByParticipant.get(p.id) ?? 0,
    groupRankingPoints: groupPointsByParticipant.get(p.id) ?? 0,
    bonusPoints: bonusPointsByParticipant.get(p.id) ?? 0,
  }));

  const standings = computeStandings(standingsInput);

  const latestBatch = await getLatestSnapshotBatch(tournamentId);
  if (latestBatch !== null && standingsEqual(standings, latestBatch)) {
    return { tournamentId, captured: false, participantsCount: standings.length };
  }

  await db.insert(leaderboardSnapshots).values(
    standings.map((entry) => ({
      tournamentId,
      participantId: entry.participantId,
      rank: entry.rank,
      totalPoints: entry.totalPoints,
      matchPoints: entry.matchPoints,
      groupRankingPoints: entry.groupRankingPoints,
      bonusPoints: entry.bonusPoints,
    })),
  );

  return { tournamentId, captured: true, participantsCount: standings.length };
}

/** Row shape shared by match/group/bonus prediction selects below. */
type ScoredRow = { participantId: string; pointsEarned: number | null };

function sumByParticipant(rows: ScoredRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.participantId, (totals.get(row.participantId) ?? 0) + (row.pointsEarned ?? 0));
  }
  return totals;
}

/** Exported for reuse by the recalculation-preview orchestration (Phase 7
 * task #61), which needs each participant's *current* match points as the
 * baseline the proposed correction's delta is applied on top of — the same
 * totals this module sums for a snapshot, so "current standings" always
 * agrees with what the leaderboard/snapshot pipeline would compute. */
export async function sumMatchPoints(tournamentId: string): Promise<Map<string, number>> {
  const tournamentMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));
  if (tournamentMatches.length === 0) return new Map();

  const rows = await db
    .select({
      participantId: matchPredictions.participantId,
      pointsEarned: matchPredictions.pointsEarned,
    })
    .from(matchPredictions)
    .where(
      inArray(
        matchPredictions.matchId,
        tournamentMatches.map((m) => m.id),
      ),
    );
  return sumByParticipant(rows);
}

/** Exported for reuse by the recalculation-preview orchestration — see `sumMatchPoints` above. */
export async function sumGroupPoints(tournamentId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({
      participantId: groupPredictions.participantId,
      pointsEarned: groupPredictions.pointsEarned,
    })
    .from(groupPredictions)
    .where(eq(groupPredictions.tournamentId, tournamentId));
  return sumByParticipant(rows);
}

/** Exported for reuse by the recalculation-preview orchestration — see `sumMatchPoints` above. */
export async function sumBonusPoints(tournamentId: string): Promise<Map<string, number>> {
  const categories = await db
    .select({ id: bonusCategories.id })
    .from(bonusCategories)
    .where(eq(bonusCategories.tournamentId, tournamentId));
  if (categories.length === 0) return new Map();

  const rows = await db
    .select({
      participantId: bonusPredictions.participantId,
      pointsEarned: bonusPredictions.pointsEarned,
    })
    .from(bonusPredictions)
    .where(
      inArray(
        bonusPredictions.categoryId,
        categories.map((c) => c.id),
      ),
    );
  return sumByParticipant(rows);
}

/** The most recent capture's rows, or null if the tournament has never been snapshotted. */
async function getLatestSnapshotBatch(
  tournamentId: string,
): Promise<StandingsEntry[] | null> {
  const rows = await db
    .select()
    .from(leaderboardSnapshots)
    .where(eq(leaderboardSnapshots.tournamentId, tournamentId));
  if (rows.length === 0) return null;

  const latestTime = Math.max(...rows.map((r) => r.capturedAt.getTime()));
  return rows
    .filter((r) => r.capturedAt.getTime() === latestTime)
    .map((r) => ({
      participantId: r.participantId,
      rank: r.rank,
      totalPoints: r.totalPoints,
      matchPoints: r.matchPoints,
      groupRankingPoints: r.groupRankingPoints,
      bonusPoints: r.bonusPoints,
    }));
}

/** Order-independent comparison (both sides may be in different order — computeStandings
 * sorts by totalPoints/participantId, the stored batch by insertion order). */
function standingsEqual(a: StandingsEntry[], b: StandingsEntry[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((entry) => [entry.participantId, entry]));
  return a.every((entry) => {
    const other = byId.get(entry.participantId);
    return (
      other !== undefined &&
      other.rank === entry.rank &&
      other.totalPoints === entry.totalPoints &&
      other.matchPoints === entry.matchPoints &&
      other.groupRankingPoints === entry.groupRankingPoints &&
      other.bonusPoints === entry.bonusPoints
    );
  });
}
