/**
 * football-data.org `/scorers` -> ScoreRush canonical bonus-stat shape
 * (ARCHITECTURE.md §5, DECISIONS.md §3a). A single scorer entry carries both
 * a goals tally and an assists tally, so this derives TWO independent
 * ranked lists ("top_scorer" and "top_assists") from the same input —
 * `statKey` is what lets the rest of the system tell them apart (types.ts).
 */
import { rankByValue } from "../normalize";
import type { CanonicalBonusStatResult } from "../types";
import type { FDScorer } from "./bonus-stats-schema";

export const TOP_SCORER_STAT_KEY = "top_scorer";
export const TOP_ASSISTS_STAT_KEY = "top_assists";

export function normalizeFootballDataScorers(
  scorers: readonly FDScorer[],
): CanonicalBonusStatResult[] {
  const scorerEntries = scorers.map((s) => ({
    refId: String(s.player.id),
    label: s.player.name,
    value: s.goals ?? 0,
  }));

  // `assists` is sometimes null in the raw response (DECISIONS.md §3a) —
  // treated as 0, same as a player with no reported assists, never an error.
  const assistEntries = scorers.map((s) => ({
    refId: String(s.player.id),
    label: s.player.name,
    value: s.assists ?? 0,
  }));

  return [
    { statKey: TOP_SCORER_STAT_KEY, entries: rankByValue(scorerEntries) },
    { statKey: TOP_ASSISTS_STAT_KEY, entries: rankByValue(assistEntries) },
  ];
}
