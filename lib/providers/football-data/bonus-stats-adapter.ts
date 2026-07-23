import type {
  BonusStatsAdapter,
  BonusStatsFetchResult,
  ProviderConfig,
  ValidationWarning,
} from "../types";
import {
  normalizeFootballDataScorers,
  TOP_ASSISTS_STAT_KEY,
  TOP_SCORER_STAT_KEY,
} from "./bonus-stats-normalize";
import { fdScorerSchema, type FDScorer } from "./bonus-stats-schema";

/** Shape of `tournament_providers.bonus_stats_config` when `bonus_stats_provider = "football_data_org"`. */
export interface FootballDataBonusStatsConfig extends ProviderConfig {
  /** e.g. "WC" | "CL" | "EC" — same competition-code vocabulary as the match-data config. */
  competitionCode: string;
  season?: number;
  limit?: number;
}

function isFootballDataBonusStatsConfig(
  config: ProviderConfig,
): config is FootballDataBonusStatsConfig {
  return (
    typeof config.competitionCode === "string" &&
    config.competitionCode.length > 0
  );
}

export const footballDataBonusStatsAdapter: BonusStatsAdapter = {
  // Matches the `bonus_stats_provider` column (lib/db/schema/config.ts) —
  // same provider-name string as the match-data adapter, since both are
  // "football-data.org", just configured on separate columns.
  providerName: "football_data_org",

  async fetchBonusStats(
    config: ProviderConfig,
  ): Promise<BonusStatsFetchResult> {
    if (!isFootballDataBonusStatsConfig(config)) {
      throw new Error(
        'football_data_org bonus-stats adapter requires a "competitionCode" string in bonus_stats_config',
      );
    }
    // Dynamically imported for the same reason as the match adapter: ./client
    // carries `import "server-only"`, and this file must stay importable from
    // Vitest so the pure validation/normalization path can be contract-tested
    // against fixtures without a network call.
    const { fetchFootballDataScorers } = await import("./client");
    const payload = await fetchFootballDataScorers(config.competitionCode, {
      season: config.season,
      limit: config.limit,
    });
    return normalizeFootballDataScorersResponse(payload);
  },
};

/**
 * Validation (shape check) + normalization for one competition's scorers
 * envelope. Exported separately so contract tests can feed a fixture payload
 * directly. One bad scorer entry never rejects the whole response — it
 * becomes a warning and the rest still normalize (ARCHITECTURE.md §5).
 */
export function normalizeFootballDataScorersResponse(
  payload: unknown,
): BonusStatsFetchResult {
  const warnings: ValidationWarning[] = [];

  const envelope = payload as { scorers?: unknown[] } | null | undefined;
  const rawScorers = Array.isArray(envelope?.scorers) ? envelope.scorers : null;

  if (!rawScorers) {
    warnings.push({
      refId: "response",
      message:
        "football-data.org scorers response is missing a `scorers` array — treated as zero entries",
    });
    return {
      stats: [
        { statKey: TOP_SCORER_STAT_KEY, entries: [] },
        { statKey: TOP_ASSISTS_STAT_KEY, entries: [] },
      ],
      warnings,
    };
  }

  const parsedScorers: FDScorer[] = [];
  for (const rawScorer of rawScorers) {
    const parsed = fdScorerSchema.safeParse(rawScorer);
    if (!parsed.success) {
      const maybeId = (rawScorer as { player?: { id?: unknown } } | null)
        ?.player?.id;
      const refId = typeof maybeId === "number" ? String(maybeId) : "unknown";
      warnings.push({
        refId,
        message: `football-data scorer entry failed shape validation, dropped: ${parsed.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      });
      continue;
    }
    parsedScorers.push(parsed.data);
  }

  return { stats: normalizeFootballDataScorers(parsedScorers), warnings };
}
