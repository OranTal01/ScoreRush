/**
 * Pure standings computation (ROADMAP.md Phase 6). Takes each participant's
 * already-summed point parts and produces the ranked leaderboard — every
 * total goes through `aggregateParticipantScore` (participant-scoring.ts),
 * the single place SCORING-RULES.md §9's "totalPoints = matchPoints +
 * groupRankingPoints + bonusPoints, always" identity is computed, so the
 * leaderboard can never silently disagree with the bonus/points breakdown
 * surfaces.
 *
 * Ranking uses standard competition ranking ("1-2-2-4"): participants with
 * equal totals share the same rank and the next distinct total skips the
 * tied positions — SCORING-RULES.md §6's "equal values must display equal
 * rank" principle, and the shape §8's shared/tied prize display keys off.
 *
 * Ties are ordered by `participantId` (not display name) so the output is
 * deterministic for a given set of inputs — the snapshot pipeline
 * (snapshots.ts) compares consecutive standings batches to skip no-change
 * captures, which only works if identical inputs always serialize
 * identically. Display-level ordering concerns stay in the UI.
 *
 * DB-free by design (ARCHITECTURE.md §2): reading the scored prediction
 * rows and persisting `leaderboard_snapshots` is the snapshot pipeline's
 * job, not this module's.
 */
import {
  aggregateParticipantScore,
  type ParticipantScoreBreakdown,
} from "./participant-scoring";

export interface StandingsInput {
  participantId: string;
  matchPoints: number;
  groupRankingPoints: number;
  bonusPoints: number;
}

export interface StandingsEntry extends ParticipantScoreBreakdown {
  participantId: string;
  rank: number;
}

export function computeStandings(
  entries: readonly StandingsInput[],
): StandingsEntry[] {
  const aggregated = entries
    .map((entry) => ({
      participantId: entry.participantId,
      ...aggregateParticipantScore(entry),
    }))
    .sort(
      (a, b) =>
        b.totalPoints - a.totalPoints ||
        a.participantId.localeCompare(b.participantId),
    );

  const standings: StandingsEntry[] = [];
  for (const [index, entry] of aggregated.entries()) {
    const previous = standings[index - 1];
    const rank =
      previous !== undefined && entry.totalPoints === previous.totalPoints
        ? previous.rank
        : index + 1;
    standings.push({ ...entry, rank });
  }
  return standings;
}
