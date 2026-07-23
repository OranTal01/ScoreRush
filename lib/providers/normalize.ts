/**
 * Provider-agnostic normalization helpers — pure functions shared by every
 * adapter (football-data.org, manual, and any future provider). Keeping
 * these here (rather than duplicated per-adapter) is what makes "distinct,
 * separately stored/derived concepts — never conflated" (ARCHITECTURE.md §5)
 * actually hold across providers.
 */
import type { MatchScore } from "@/lib/db/schema/competition";
import type { CanonicalBonusStatEntry, MatchWinner } from "./types";

/**
 * Converts a possibly-partial `{home, away}` pair into a `MatchScore`, or
 * `null` if either side is missing — never fabricates a `0` for a score
 * that hasn't actually been reported yet.
 */
export function toMatchScore(
  pair:
    | { home: number | null | undefined; away: number | null | undefined }
    | null
    | undefined,
): MatchScore | null {
  if (!pair) return null;
  if (pair.home == null || pair.away == null) return null;
  return { home: pair.home, away: pair.away };
}

/** A real score is a non-negative integer pair — anything else is a bad payload, not a "score of -1". */
export function isValidMatchScore(score: MatchScore): boolean {
  return (
    Number.isInteger(score.home) &&
    Number.isInteger(score.away) &&
    score.home >= 0 &&
    score.away >= 0
  );
}

/**
 * Derives a winner from a decisive score pair. This is arithmetic, not a
 * guess: given a real, already-validated result, "who has more goals" is
 * unambiguous. Used as a fallback when a provider doesn't supply its own
 * winner field, and by the manual adapter (which never gets one).
 */
export function deriveWinner(result: MatchScore | null): MatchWinner {
  if (!result) return null;
  if (result.home > result.away) return "home";
  if (result.away > result.home) return "away";
  return "draw";
}

/**
 * Assigns competition ranking (1,2,2,4 — ties share a rank, the next
 * distinct value's rank skips accordingly) to a set of bonus-stat entries,
 * per SCORING-RULES.md §6: "equal values must display equal rank." Sorts
 * descending by `value` itself — callers pass raw entries in any order —
 * because computing ties correctly requires seeing the whole list at once,
 * which is exactly what this shared helper has in hand. Used by both the
 * football-data.org bonus-stats adapter and the manual one, so "top scorer"
 * and a manually-entered category rank identically.
 */
export function rankByValue(
  entries: readonly Omit<CanonicalBonusStatEntry, "rank">[],
): CanonicalBonusStatEntry[] {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const ranked: CanonicalBonusStatEntry[] = [];
  let previousValue: number | null = null;
  let previousRank = 0;

  sorted.forEach((entry, index) => {
    const rank =
      previousValue !== null && entry.value === previousValue
        ? previousRank
        : index + 1;
    ranked.push({ ...entry, rank });
    previousValue = entry.value;
    previousRank = rank;
  });

  return ranked;
}
