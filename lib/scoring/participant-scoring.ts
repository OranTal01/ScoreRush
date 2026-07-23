/**
 * Final aggregation step (SCORING-RULES.md §9): "totalPoints = matchPoints +
 * groupRankingPoints + bonusPoints, always." This is the single place that
 * sum is computed, so the leaderboard (Phase 6) and the bonus breakdown UI
 * can never silently disagree — every caller that needs a participant's
 * total goes through this function rather than adding the three parts
 * inline itself.
 */

export interface ParticipantScoreBreakdown {
  matchPoints: number;
  groupRankingPoints: number;
  bonusPoints: number;
  totalPoints: number;
}

export function aggregateParticipantScore(parts: {
  matchPoints: number;
  groupRankingPoints: number;
  bonusPoints: number;
}): ParticipantScoreBreakdown {
  const { matchPoints, groupRankingPoints, bonusPoints } = parts;
  return {
    matchPoints,
    groupRankingPoints,
    bonusPoints,
    totalPoints: matchPoints + groupRankingPoints + bonusPoints,
  };
}

/** Sums `points` off any list of already-scored entries (match/group/bonus prediction rows alike). */
export function sumPoints(entries: readonly { points: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.points, 0);
}
