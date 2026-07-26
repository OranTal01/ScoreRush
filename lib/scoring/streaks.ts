/**
 * Pure prediction-streak/accuracy computation (ROADMAP.md Phase 9 gap-fill,
 * backs the home dashboard's achievements card — UX-BLUEPRINT.md screen 1
 * "achievements" and screen 9 "streaks, prediction accuracy").
 *
 * Was previously three hardcoded/static values in `lib/mock` (one of them,
 * "3 exact predictions in a row", wasn't even wired to the mock
 * participant's own data — it never changed). This derives real numbers
 * from each of the caller's own scored `match_predictions.outcome` values
 * (lib/db/schema/enums.ts predictionOutcomeEnum) — never fabricated.
 *
 * DB-free by design (ARCHITECTURE.md §2), same rationale as
 * lib/scoring/leaderboard.ts: reading the rows is the caller's job (here,
 * lib/matches/list.ts's `listTournamentMatches`), this module only computes.
 */
import type { PredictionOutcome } from "@/lib/matches/list";

export interface ScoredPrediction {
  /** Match kickoff — determines recency ordering, not `submittedAt`/`editedAt`. */
  kickoff: string;
  outcome: PredictionOutcome | null;
}

export interface PredictionStreaks {
  /** Consecutive most-recent matches (by kickoff) predicted exactly right. */
  exactStreak: number;
  /** Consecutive most-recent matches predicted with any points-earning outcome (not "wrong"). */
  correctStreak: number;
  /** Rounded percent of scored predictions that weren't "wrong". Null with zero scored predictions. */
  accuracyPercent: number | null;
}

/** Only matches with a resolved `outcome` count — unscored (future/pending)
 * matches are excluded rather than treated as breaks or successes. */
export function computePredictionStreaks(
  entries: readonly ScoredPrediction[],
): PredictionStreaks {
  const scored = entries
    .filter((e): e is ScoredPrediction & { outcome: PredictionOutcome } =>
      e.outcome !== null,
    )
    .slice()
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());

  let exactStreak = 0;
  for (const entry of scored) {
    if (entry.outcome !== "exact") break;
    exactStreak++;
  }

  let correctStreak = 0;
  for (const entry of scored) {
    if (entry.outcome === "wrong") break;
    correctStreak++;
  }

  const accuracyPercent =
    scored.length === 0
      ? null
      : Math.round(
          (100 * scored.filter((e) => e.outcome !== "wrong").length) /
            scored.length,
        );

  return { exactStreak, correctStreak, accuracyPercent };
}
