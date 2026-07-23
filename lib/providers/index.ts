/**
 * Registry mapping a tournament's `tournament_providers.match_data_provider`
 * string to its adapter — the sync job (lib/sync/run-sync.ts) looks a
 * tournament's configured provider up here rather than branching on
 * provider identity itself (ARCHITECTURE.md §6).
 */
import { footballDataAdapter } from "./football-data/adapter";
import { footballDataBonusStatsAdapter } from "./football-data/bonus-stats-adapter";
import { manualAdapter } from "./manual/adapter";
import { manualBonusStatsAdapter } from "./manual/bonus-stats-adapter";
import type { BonusStatsAdapter, MatchDataAdapter } from "./types";

export const matchDataAdapters: Record<string, MatchDataAdapter> = {
  [footballDataAdapter.providerName]: footballDataAdapter,
  [manualAdapter.providerName]: manualAdapter,
};

export function getMatchDataAdapter(
  providerName: string,
): MatchDataAdapter | null {
  return matchDataAdapters[providerName] ?? null;
}

/**
 * Mirrors `matchDataAdapters` but is a deliberately separate registry
 * (types.ts `BonusStatsAdapter` doc): `tournament_providers.bonus_stats_provider`
 * is an independent column from `match_data_provider`, so a tournament can
 * mix providers (e.g. football-data.org for matches, manual for bonus stats).
 */
export const bonusStatsAdapters: Record<string, BonusStatsAdapter> = {
  [footballDataBonusStatsAdapter.providerName]: footballDataBonusStatsAdapter,
  [manualBonusStatsAdapter.providerName]: manualBonusStatsAdapter,
};

export function getBonusStatsAdapter(
  providerName: string,
): BonusStatsAdapter | null {
  return bonusStatsAdapters[providerName] ?? null;
}

export * from "./types";
export { footballDataAdapter } from "./football-data/adapter";
export { manualAdapter } from "./manual/adapter";
export { footballDataBonusStatsAdapter } from "./football-data/bonus-stats-adapter";
export { manualBonusStatsAdapter } from "./manual/bonus-stats-adapter";
