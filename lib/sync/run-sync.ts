/**
 * Orchestrates one sync run for a tournament (ARCHITECTURE.md §7): look up
 * which adapter the tournament is bound to, fetch + normalize, write
 * canonical matches, and log the outcome to `sync_logs` regardless of
 * success or failure — independent of whether anything actually changed.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { syncLogs } from "@/lib/db/schema/audit";
import { tournamentProviders } from "@/lib/db/schema/config";
import { getMatchDataAdapter } from "@/lib/providers";
import type { ProviderConfig } from "@/lib/providers/types";
import { upsertCanonicalMatch } from "./upsert-matches";

export interface SyncRunResult {
  tournamentId: string;
  provider: string;
  outcome: "success" | "error";
  durationMs: number;
  matchesUpserted: number;
  matchesCreated: number;
  matchesUpdated: number;
  warnings: string[];
  errorDetail: string | null;
}

export async function syncTournamentMatches(
  tournamentId: string,
): Promise<SyncRunResult> {
  const startedAt = Date.now();

  const [config] = await db
    .select()
    .from(tournamentProviders)
    .where(eq(tournamentProviders.tournamentId, tournamentId))
    .limit(1);

  const provider = config?.matchDataProvider ?? "manual";

  const result: SyncRunResult = {
    tournamentId,
    provider,
    outcome: "success",
    durationMs: 0,
    matchesUpserted: 0,
    matchesCreated: 0,
    matchesUpdated: 0,
    warnings: [],
    errorDetail: null,
  };

  try {
    if (!config) {
      throw new Error(
        `tournament ${tournamentId} has no tournament_providers row configured`,
      );
    }

    const adapter = getMatchDataAdapter(provider);
    if (!adapter) {
      throw new Error(
        `no adapter registered for match_data_provider "${provider}"`,
      );
    }

    const fetchResult = await adapter.fetchMatches(
      (config.matchDataConfig as ProviderConfig) ?? {},
    );
    result.warnings.push(
      ...fetchResult.warnings.map((w) => `${w.refId}: ${w.message}`),
    );

    // ARCHITECTURE.md §5: a provider failure must never silently erase
    // valid last-known data. We only ever add/update rows here — a match
    // this fetch didn't mention (e.g. dropped by a validation failure
    // upstream) simply isn't touched, so its last-known-good state stands.
    for (const canonical of fetchResult.matches) {
      const outcome = await upsertCanonicalMatch(tournamentId, canonical);
      result.matchesUpserted += 1;
      if (outcome.created) {
        result.matchesCreated += 1;
      } else {
        result.matchesUpdated += 1;
      }
      result.warnings.push(...outcome.warnings);
    }
  } catch (err) {
    result.outcome = "error";
    result.errorDetail = err instanceof Error ? err.message : String(err);
  }

  result.durationMs = Date.now() - startedAt;

  await db.insert(syncLogs).values({
    tournamentId,
    provider,
    outcome: result.outcome,
    durationMs: result.durationMs,
    errorDetail: result.errorDetail,
  });

  return result;
}
