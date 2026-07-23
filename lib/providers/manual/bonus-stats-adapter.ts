import type {
  BonusStatsAdapter,
  BonusStatsFetchResult,
  CanonicalBonusStatResult,
  ProviderConfig,
  ValidationWarning,
} from "../types";
import { normalizeManualBonusStat } from "./bonus-stats-normalize";
import { manualBonusStatInputSchema } from "./bonus-stats-schema";

/**
 * Shape of `tournament_providers.bonus_stats_config` when
 * `bonus_stats_provider = "manual"`. `stats` holds one or more admin-defined
 * categories at once — this is the fallback path for custom tournaments or
 * any competition football-data.org doesn't cover (DECISIONS.md §3a).
 */
export interface ManualBonusStatsConfig extends ProviderConfig {
  stats: unknown[];
}

function isManualBonusStatsConfig(
  config: ProviderConfig,
): config is ManualBonusStatsConfig {
  return Array.isArray((config as { stats?: unknown }).stats);
}

export const manualBonusStatsAdapter: BonusStatsAdapter = {
  providerName: "manual",

  async fetchBonusStats(
    config: ProviderConfig,
  ): Promise<BonusStatsFetchResult> {
    if (!isManualBonusStatsConfig(config)) {
      throw new Error(
        'manual bonus-stats adapter requires a "stats" array in bonus_stats_config',
      );
    }
    return normalizeManualBonusStatsInput(config.stats);
  },
};

/** Exported separately so contract tests can feed raw admin-shaped categories directly. */
export function normalizeManualBonusStatsInput(
  stats: unknown[],
): BonusStatsFetchResult {
  const results: CanonicalBonusStatResult[] = [];
  const warnings: ValidationWarning[] = [];

  stats.forEach((entry, index) => {
    const parsed = manualBonusStatInputSchema.safeParse(entry);
    if (!parsed.success) {
      warnings.push({
        refId: `manual-bonus-stat-${index}`,
        message: `manual bonus-stat category failed shape validation, dropped: ${parsed.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      });
      return;
    }
    const { result, warnings: entryWarnings } = normalizeManualBonusStat(
      parsed.data,
    );
    results.push(result);
    warnings.push(...entryWarnings);
  });

  return { stats: results, warnings };
}
