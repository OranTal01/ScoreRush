/**
 * Match prediction scoring (SCORING-RULES.md §2-3).
 *
 * Pure functions only — no DB access here (ARCHITECTURE.md §2: "domain logic
 * is pure, testable functions; the database is a boundary, not a dependency").
 * Callers are responsible for only ever passing `matches.regularResult`
 * (never `extraTimeResult`/`penaltyResult`) as the actual score — see
 * `scoreMatch` below, which enforces that at the type/call-site level so a
 * caller can't accidentally score against extra-time or penalties.
 */
import type { MatchScore } from "@/lib/db/schema/competition";

/**
 * Display-level outcome classification. Scores exactly the same 4-tier point
 * value as the legacy project (world-cup-bets/features/scoring/domain/scoring.ts)
 * for 4 of these 5 labels — `draw_correct` is a *display* distinction only
 * (SCORING-RULES.md §10 has a dedicated Hebrew string for it, distinct from
 * "predicted the winner + difference"), not a 5th point tier: a correctly
 * predicted draw always has actual/predicted goal difference 0 === 0, so it
 * always lands on the winner-and-diff point value, never winner-only.
 */
export type MatchOutcome =
  | "exact"
  | "winner_diff"
  | "winner"
  | "draw_correct"
  | "wrong";

export interface MatchScoringRules {
  exactScorePoints: number;
  winnerAndDiffPoints: number;
  winnerOnlyPoints: number;
  wrongPoints: number;
}

export interface MatchPredictionScore {
  outcome: MatchOutcome;
  points: number;
}

/** A `matches` row's outcome-relevant fields — deliberately just the 90-minute-and-beyond result fields, never the raw provider payload. */
export interface ScorableMatch {
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  /** Canonical 90-minute + stoppage result — the ONLY input to prediction scoring (SCORING-RULES.md §3). */
  regularResult: MatchScore | null;
}

function resultSide(score: MatchScore): "home" | "away" | "draw" {
  if (score.home > score.away) return "home";
  if (score.away > score.home) return "away";
  return "draw";
}

/**
 * Core scoring rule (SCORING-RULES.md §2). Only ever call this with a
 * regulation-time (90 minutes + stoppage) score — extra time and penalty
 * shootout kicks never count (§3). Use `scoreMatch` below when working from
 * a full `matches` row so that constraint is enforced structurally.
 */
export function scoreMatchPrediction(
  actual: MatchScore,
  predicted: MatchScore,
  rules: MatchScoringRules,
): MatchPredictionScore {
  if (actual.home === predicted.home && actual.away === predicted.away) {
    return { outcome: "exact", points: rules.exactScorePoints };
  }

  const actualSide = resultSide(actual);
  const predictedSide = resultSide(predicted);
  if (actualSide !== predictedSide) {
    return { outcome: "wrong", points: rules.wrongPoints };
  }

  const actualDiff = Math.abs(actual.home - actual.away);
  const predictedDiff = Math.abs(predicted.home - predicted.away);
  if (actualDiff === predictedDiff) {
    // Both outcomes match and both goal differences match, but the exact
    // score doesn't. When the shared outcome is "draw" this is always the
    // case (a draw's difference is always 0), so it gets its own display
    // label instead of "winner_diff" — there is no "winner" in a draw.
    return {
      outcome: actualSide === "draw" ? "draw_correct" : "winner_diff",
      points: rules.winnerAndDiffPoints,
    };
  }

  return { outcome: "winner", points: rules.winnerOnlyPoints };
}

/**
 * Scores a full `matches` row against a participant's prediction, or returns
 * `null` when the match has no scorable result yet (not finished, or
 * finished-but-flagged with a null `regularResult` — ARCHITECTURE.md §5:
 * flagged rows are surfaced for a human, never guessed at). Structurally
 * guarantees extra-time/penalty results can never leak into prediction
 * scoring, since `ScorableMatch` doesn't expose them to this function at all.
 */
export function scoreMatch(
  match: ScorableMatch,
  predicted: MatchScore,
  rules: MatchScoringRules,
): MatchPredictionScore | null {
  if (match.status !== "finished" || match.regularResult === null) {
    return null;
  }
  return scoreMatchPrediction(match.regularResult, predicted, rules);
}
