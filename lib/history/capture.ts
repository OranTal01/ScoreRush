import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  matches,
  participants,
  tournaments,
  matchPredictions,
  roundHistory,
} from "@/lib/db/schema";
import {
  sumMatchPoints,
  sumGroupPoints,
  sumBonusPoints,
} from "@/lib/scoring/snapshots";
import { computeStandings } from "@/lib/scoring/leaderboard";
import { groupRounds, roundIsSettled, shouldCaptureRound } from "./rounds";

type HistoryStore = Pick<typeof db, "select" | "insert" | "update" | "execute">;
export async function captureRoundHistory(
  tournamentId: string,
  tx?: HistoryStore,
): Promise<{ captured: number }> {
  if (!tx)
    return db.transaction((store) => captureRoundHistory(tournamentId, store));
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${"scoring:" + tournamentId},0))`,
  );
  const [tournament] = await tx
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  if (!tournament) return { captured: 0 };
  const allMatches = await tx
    .select({
      id: matches.id,
      stage: matches.stage,
      matchday: matches.matchday,
      kickoff: matches.kickoff,
      status: matches.status,
      regularResult: matches.regularResult,
      normalizationStatus: matches.normalizationStatus,
    })
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));
  const members = await tx
    .select({ id: participants.id, name: participants.displayName })
    .from(participants)
    .where(eq(participants.tournamentId, tournamentId));
  if (!members.length || !allMatches.length) return { captured: 0 };
  const records = await tx
    .select()
    .from(roundHistory)
    .where(eq(roundHistory.tournamentId, tournamentId));
  const predictions = await tx
    .select({
      matchId: matchPredictions.matchId,
      participantId: matchPredictions.participantId,
      points: matchPredictions.pointsEarned,
      outcome: matchPredictions.outcome,
    })
    .from(matchPredictions)
    .where(
      inArray(
        matchPredictions.matchId,
        allMatches.map((m) => m.id),
      ),
    );
  const matchPoints = await sumMatchPoints(tournamentId, tx);
  const groupPoints = await sumGroupPoints(tournamentId, tx);
  const bonusPoints = await sumBonusPoints(tournamentId, tx);
  const standings = computeStandings(
    members.map((p) => ({
      participantId: p.id,
      matchPoints: matchPoints.get(p.id) ?? 0,
      groupRankingPoints: groupPoints.get(p.id) ?? 0,
      bonusPoints: bonusPoints.get(p.id) ?? 0,
    })),
  );
  const names = new Map(members.map((p) => [p.id, p.name]));
  let captured = 0;
  for (const round of groupRounds(allMatches)) {
    const settled = roundIsSettled(round.matches, {
      onboarding_open: tournament.onboardingOpen,
      onboarding_matchday: tournament.onboardingMatchday,
    });
    const record = records.find((r) => r.roundKey === round.key);
    if (!record) {
      await tx
        .insert(roundHistory)
        .values({
          tournamentId,
          roundKey: round.key,
          label: round.label,
          trackedOpen: !settled,
        });
      continue;
    }
    const playedIds = new Set(
      round.matches.filter((m) => m.status !== "cancelled").map((m) => m.id),
    );
    const picks = predictions.filter((p) => playedIds.has(p.matchId));
    const scored = new Set(
      picks
        .filter((p) => p.points !== null)
        .map((p) => `${p.participantId}:${p.matchId}`),
    );
    const fullyScored = members.every((p) =>
      [...playedIds].every((id) => scored.has(`${p.id}:${id}`)),
    );
    if (
      !shouldCaptureRound(
        record.trackedOpen,
        record.capturedAt,
        settled,
        fullyScored,
      )
    )
      continue;
    await tx
      .update(roundHistory)
      .set({
        capturedAt: new Date(),
        standings: standings.map((p) => {
          const own = picks.filter(
            (pick) => pick.participantId === p.participantId,
          );
          return {
            id: p.participantId,
            name: names.get(p.participantId)!,
            rank: p.rank,
            total: p.totalPoints,
            roundPoints: own.reduce((sum, pick) => sum + (pick.points ?? 0), 0),
            exact: own.filter((pick) => pick.outcome === "exact").length,
          };
        }),
      })
      .where(eq(roundHistory.id, record.id));
    captured++;
  }
  return { captured };
}
