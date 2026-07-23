/**
 * Bonus category scoring (SCORING-RULES.md §6-7). Ported from the legacy
 * project's weighted-choice scoring (world-cup-bets/features/scoring/domain/bonus-scoring.ts),
 * generalized from 3 hardcoded categories to any number of admin-configured
 * `bonus_categories`/`bonus_slots`.
 */

export interface BonusStatWinner {
  /** Provider/player/team id, when the source has one — null for a manual entry with no stable id. */
  refId: string | null;
  label: string;
  /** Competition ranking (ties share rank 1) — see lib/providers/normalize.ts `rankByValue`. */
  rank: number;
}

export interface BonusPick {
  slotId: string;
  points: number;
  pickRefId: string | null;
  pickLabel: string;
}

export interface BonusCategoryInfo {
  resolvesAt: "ongoing" | "tournament_end";
}

/**
 * A pick matches a resolved winner by `refId` when both sides have one
 * (the reliable, provider-stable identifier); falls back to an exact label
 * match only when either side lacks a `refId` (e.g. a manual entry with no
 * stable id) — mirrors how `bonus_predictions.pickRefId` /
 * `bonus_stats.refId` are both documented as "optional... if applicable."
 */
function isWinningPick(winner: BonusStatWinner, pick: BonusPick): boolean {
  if (winner.refId !== null && pick.pickRefId !== null) {
    return winner.refId === pick.pickRefId;
  }
  return winner.label === pick.pickLabel;
}

/**
 * Sums `pick.points` for every pick that matches a rank-1 (winning) stat —
 * ties for first all count as winners (SCORING-RULES.md §6: "only first
 * place counts, including ties"). Duplicate picks across slots stack
 * automatically here, since each slot is scored independently — a category
 * with `duplicateStackingAllowed: false` must instead be enforced by
 * rejecting duplicate picks at prediction-submission time (task #49), not by
 * changing this scoring math.
 */
export function scoreBonusCategory(
  picks: readonly BonusPick[],
  stats: readonly BonusStatWinner[],
): number {
  const winners = stats.filter((s) => s.rank === 1);
  let total = 0;
  for (const pick of picks) {
    if (winners.some((winner) => isWinningPick(winner, pick))) {
      total += pick.points;
    }
  }
  return total;
}

/**
 * Terminal categories (`resolves_at: "tournament_end"`, e.g. Champion,
 * Runner-up) must stay excluded from bonusPoints/totalPoints until the real
 * outcome is known (SCORING-RULES.md §7) — "known" is inferred here as the
 * tournament itself having reached its `finished` status
 * (`tournaments.status`), the only closed-form "the tournament is over"
 * signal in the schema. `resolves_at: "ongoing"` categories are always
 * scorable, at whatever partial/current state their bonus_stats snapshot
 * reflects.
 */
export function isBonusCategoryScorable(
  category: BonusCategoryInfo,
  tournamentStatus: "upcoming" | "active" | "finished",
): boolean {
  return category.resolvesAt === "ongoing" || tournamentStatus === "finished";
}
