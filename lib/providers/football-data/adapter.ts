import type {
  AdapterFetchResult,
  CanonicalMatch,
  MatchDataAdapter,
  ProviderConfig,
  ValidationWarning,
} from "../types";
import { normalizeFootballDataMatch } from "./normalize";
import { fdMatchSchema } from "./schema";

/** Shape of `tournament_providers.match_data_config` when `match_data_provider = "football_data_org"`. */
export interface FootballDataConfig extends ProviderConfig {
  /** e.g. "WC" | "CL" | "EC" — football-data.org's short competition code. */
  competitionCode: string;
  season?: number;
}

function isFootballDataConfig(
  config: ProviderConfig,
): config is FootballDataConfig {
  return (
    typeof config.competitionCode === "string" &&
    config.competitionCode.length > 0
  );
}

export const footballDataAdapter: MatchDataAdapter = {
  // Matches the `match_data_provider` example already documented on
  // `tournament_providers` (lib/db/schema/config.ts).
  providerName: "football_data_org",

  async fetchMatches(config: ProviderConfig): Promise<AdapterFetchResult> {
    if (!isFootballDataConfig(config)) {
      throw new Error(
        'football_data_org adapter requires a "competitionCode" string in match_data_config',
      );
    }
    // Dynamically imported: ./client carries `import "server-only"`, and
    // this file must stay importable from Vitest (which has no RSC/server
    // resolution condition) so `normalizeFootballDataResponse` below can be
    // contract-tested against fixtures without touching the network client.
    const { fetchFootballDataMatches } = await import("./client");
    const payload = await fetchFootballDataMatches(
      config.competitionCode,
      config.season,
    );
    return normalizeFootballDataResponse(payload);
  },
};

/**
 * Validation (shape check) + normalization for one competition's matches
 * envelope. Exported separately from the adapter so contract tests can feed
 * a fixture payload directly, without a network call.
 *
 * One bad match in the array never rejects the whole response — it becomes
 * a warning and the rest still normalize (ARCHITECTURE.md §5: a provider
 * failure must never silently erase valid last-known data).
 */
export function normalizeFootballDataResponse(
  payload: unknown,
): AdapterFetchResult {
  const matches: CanonicalMatch[] = [];
  const warnings: ValidationWarning[] = [];

  const envelope = payload as { matches?: unknown[] } | null | undefined;
  const rawMatches = Array.isArray(envelope?.matches) ? envelope.matches : null;

  if (!rawMatches) {
    warnings.push({
      refId: "response",
      message:
        "football-data.org response is missing a `matches` array — treated as zero matches",
    });
    return { matches, warnings };
  }

  for (const rawMatch of rawMatches) {
    const parsed = fdMatchSchema.safeParse(rawMatch);
    if (!parsed.success) {
      const maybeId = (rawMatch as { id?: unknown } | null)?.id;
      const refId = typeof maybeId === "number" ? String(maybeId) : "unknown";
      warnings.push({
        refId,
        message: `football-data match failed shape validation, dropped: ${parsed.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      });
      continue;
    }

    const { match, warning } = normalizeFootballDataMatch(
      parsed.data,
      rawMatch,
    );
    matches.push(match);
    if (warning) warnings.push(warning);
  }

  return { matches, warnings };
}
