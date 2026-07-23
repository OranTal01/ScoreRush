import type {
  AdapterFetchResult,
  CanonicalMatch,
  MatchDataAdapter,
  ProviderConfig,
  ValidationWarning,
} from "../types";
import { normalizeManualMatch } from "./normalize";
import { manualMatchInputSchema } from "./schema";

/**
 * Shape of `tournament_providers.match_data_config` when
 * `match_data_provider = "manual"`. Unlike a live provider, "fetching" here
 * means reading back whatever the admin UI (Phase 7) has staged — the
 * `entries` array is expected to be the admin's raw form submissions,
 * unvalidated, so they go through the exact same shape/sanity checks a
 * provider payload would.
 */
export interface ManualProviderConfig extends ProviderConfig {
  entries: unknown[];
}

function isManualProviderConfig(
  config: ProviderConfig,
): config is ManualProviderConfig {
  return Array.isArray((config as { entries?: unknown }).entries);
}

export const manualAdapter: MatchDataAdapter = {
  providerName: "manual",

  async fetchMatches(config: ProviderConfig): Promise<AdapterFetchResult> {
    if (!isManualProviderConfig(config)) {
      throw new Error(
        'manual adapter requires an "entries" array in match_data_config',
      );
    }
    return normalizeManualEntries(config.entries);
  },
};

/** Exported separately so contract tests can feed raw admin-shaped entries directly. */
export function normalizeManualEntries(entries: unknown[]): AdapterFetchResult {
  const matches: CanonicalMatch[] = [];
  const warnings: ValidationWarning[] = [];

  entries.forEach((entry, index) => {
    const parsed = manualMatchInputSchema.safeParse(entry);
    if (!parsed.success) {
      warnings.push({
        refId: `manual-entry-${index}`,
        message: `manual match entry failed shape validation, dropped: ${parsed.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      });
      return;
    }

    const { match, warning } = normalizeManualMatch(parsed.data);
    matches.push(match);
    if (warning) warnings.push(warning);
  });

  return { matches, warnings };
}
