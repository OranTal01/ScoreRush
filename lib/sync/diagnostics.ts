/**
 * Read-side queries backing the admin overview's sync/normalization
 * diagnostics (ROADMAP.md Phase 4: "diagnostics surfaced in the admin UI").
 * Deliberately read-only and separate from run-sync.ts (which writes
 * `sync_logs`/`matches`) — this module only ever selects, never mutates, so
 * rendering the admin page can never have a side effect on sync state.
 *
 * Scope note: this surfaces what Phase 4 already writes (sync_logs rows,
 * matches.normalization_status/warning_flag). Richer provider-health
 * monitoring, recalculation previews, and an audit-log viewer are Phase 7
 * ("Admin tooling") — out of scope here.
 */
import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import { syncLogs } from "@/lib/db/schema/audit";
import { matches, teams } from "@/lib/db/schema/competition";
import { tournaments } from "@/lib/db/schema/identity";

export interface SyncLogDiagnostic {
  id: string;
  tournamentName: string;
  provider: string;
  outcome: "success" | "error";
  durationMs: number;
  errorDetail: string | null;
  /** ISO 8601. */
  timestamp: string;
}

export interface FlaggedMatchDiagnostic {
  id: string;
  tournamentName: string;
  homeTeamName: string;
  awayTeamName: string;
  /** ISO 8601. */
  kickoff: string;
  warningFlag: string;
}

/** Most recent sync attempts across all tournaments, newest first — the raw material for the admin overview's sync-status card. */
export async function getRecentSyncLogs(
  limit = 10,
): Promise<SyncLogDiagnostic[]> {
  const rows = await db
    .select({
      id: syncLogs.id,
      tournamentName: tournaments.name,
      provider: syncLogs.provider,
      outcome: syncLogs.outcome,
      durationMs: syncLogs.durationMs,
      errorDetail: syncLogs.errorDetail,
      timestamp: syncLogs.timestamp,
    })
    .from(syncLogs)
    .innerJoin(tournaments, eq(syncLogs.tournamentId, tournaments.id))
    .orderBy(desc(syncLogs.timestamp))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    timestamp: row.timestamp.toISOString(),
  }));
}

/**
 * Matches currently flagged during normalization (matches.normalization_status
 * = 'flagged', types.ts `ValidationWarning`) — i.e. rows that weren't
 * dropped, just surfaced for a human to look at (ARCHITECTURE.md §5).
 */
export async function getFlaggedMatches(
  limit = 20,
): Promise<FlaggedMatchDiagnostic[]> {
  const homeTeams = alias(teams, "home_teams");
  const awayTeams = alias(teams, "away_teams");

  const rows = await db
    .select({
      id: matches.id,
      tournamentName: tournaments.name,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      kickoff: matches.kickoff,
      warningFlag: matches.warningFlag,
    })
    .from(matches)
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .innerJoin(homeTeams, eq(matches.homeTeamId, homeTeams.id))
    .innerJoin(awayTeams, eq(matches.awayTeamId, awayTeams.id))
    .where(
      and(
        eq(matches.normalizationStatus, "flagged"),
        isNotNull(matches.warningFlag),
      ),
    )
    .orderBy(desc(matches.kickoff))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    kickoff: row.kickoff.toISOString(),
    // Narrowed by the `isNotNull` filter above — never actually null here.
    warningFlag: row.warningFlag as string,
  }));
}
