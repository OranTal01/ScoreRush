/**
 * Group ranking prediction scoring (SCORING-RULES.md §5). Points are only
 * ever meaningful to add to a participant's total once
 * `isGroupStageComplete` (group-standings.ts) is true — this module doesn't
 * enforce that gate itself (it's a pure comparison function), the caller
 * (participant-scoring.ts) does.
 */

/**
 * Awards `pointsPerPosition` for every index where the predicted team id
 * matches the actual standings team id at that position. Ported from the
 * legacy project's `scoreGroupRanking` (world-cup-bets/features/scoring/domain/scoring.ts),
 * generalized from a hardcoded 3-points constant to the tournament's
 * configured `scoring_rules.group_ranking_points_per_position`.
 */
export function scoreGroupRanking(
  actualOrder: readonly string[],
  predictedOrder: readonly string[],
  pointsPerPosition: number,
): number {
  const length = Math.min(actualOrder.length, predictedOrder.length);
  let total = 0;
  for (let i = 0; i < length; i++) {
    if (actualOrder[i] === predictedOrder[i]) total += pointsPerPosition;
  }
  return total;
}
