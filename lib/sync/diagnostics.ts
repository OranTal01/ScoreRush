/**
 * Read-side queries backing the admin overview's sync/normalization
 * diagnostics (ROADMAP.md Phase 4: "diagnostics surfaced in the admin UI").
 * Deliberately read-only and separate from run-sync.ts (which writes
 * `sync_logs`/`matches`) — this module only ever selects, never mutates, so
 * rendering the admin page can never have a side effect on sync state.
 *
 * Both queries are scoped to a single `tournamentId` (Phase 7 task #57):
 * `sync_logs` is admin-of-that-tournament-only per DATABASE.md §5's RLS
 * table ("Read: Admin of the tournament (+ platform admin)"), and this
 * module uses the service-role Drizzle client (bypasses RLS) precisely
 * because it's meant to serve one already-authorized admin's own tournament
 * page — without the explicit filter here, a tournament_admin of tournament
 * A would see tournament B's sync/diagnostic history too, which the RLS
 * policy would never allow the equivalent RLS-scoped Supabase query to leak.
 *
 * Scope note: this surfaces what Phase 4 already writes (sync_logs rows,
 * matches.normalization_status/warning_flag). `getProviderHealth`,
 * `getMatchDiagnosticsList`, and `getMatchDiagnostic` below extend this into
 * the full Phase 7 task #60 screen (UX-BLUEPRINT.md §4 screens #3-5:
 * per-match raw-vs-normalized, provider health, full sync log) — still
 * read-only, still service-role + explicit `tournamentId`/`matchId` filter
 * for the same reason as above. Recalculation previews and an audit-log
 * viewer remain separate, later Phase 7 tasks (#61-62).
 */
import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import { syncLogs } from "@/lib/db/schema/audit";
import { matches, teams, type MatchScore } from "@/lib/db/schema/competition";
import { tournamentProviders } from "@/lib/db/schema/config";
import { tournaments } from "@/lib/db/schema/identity";

/** Mirrors the `match_status` Postgres enum (lib/db/schema/enums.ts) — kept
 * as a local literal union rather than importing it, matching how other
 * read paths in this codebase type match status (e.g.
 * app/(app)/predictions/[matchId]/page.tsx). */
export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

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

/** Most recent sync attempts for one tournament, newest first — the raw material for the admin overview's sync-status card. */
export async function getRecentSyncLogs(
  tournamentId: string,
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
    .where(eq(syncLogs.tournamentId, tournamentId))
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
  tournamentId: string,
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
        eq(matches.tournamentId, tournamentId),
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

export interface ProviderHealth {
  matchDataProvider: string;
  bonusStatsProvider: string;
  /** ISO 8601, or null if no sync has ever succeeded within the sample window. */
  lastSuccessfulSyncAt: string | null;
  /** ISO 8601, or null if no sync has ever been attempted. */
  lastAttemptAt: string | null;
  lastOutcome: "success" | "error" | null;
  /** Out of the most recent `recentAttemptCount` sync attempts (sample window, not all-time). */
  recentErrorCount: number;
  recentAttemptCount: number;
}

/**
 * Derived provider health for one tournament (UX-BLUEPRINT.md §4 screen #4)
 * — there's no dedicated storage for "health", it's computed from the
 * tournament's `tournament_providers` binding plus its most recent
 * `sync_logs` rows (reusing `getRecentSyncLogs` rather than re-querying, so
 * this stays consistent with the sync log the admin sees right next to it).
 * Returns null only if the tournament has no `tournament_providers` row at
 * all, which shouldn't happen post-task-#58 (every tournament creation
 * writes one) but is handled defensively rather than assumed.
 */
export async function getProviderHealth(
  tournamentId: string,
  sampleSize = 20,
): Promise<ProviderHealth | null> {
  const [providerRows, recentLogs] = await Promise.all([
    db
      .select({
        matchDataProvider: tournamentProviders.matchDataProvider,
        bonusStatsProvider: tournamentProviders.bonusStatsProvider,
      })
      .from(tournamentProviders)
      .where(eq(tournamentProviders.tournamentId, tournamentId))
      .limit(1),
    getRecentSyncLogs(tournamentId, sampleSize),
  ]);

  const providerRow = providerRows[0];
  if (!providerRow) return null;

  // getRecentSyncLogs orders newest-first, so [0] is the latest attempt and
  // the first "success" match found is the latest successful one.
  const lastSuccessful =
    recentLogs.find((log) => log.outcome === "success") ?? null;

  return {
    matchDataProvider: providerRow.matchDataProvider,
    bonusStatsProvider: providerRow.bonusStatsProvider,
    lastSuccessfulSyncAt: lastSuccessful?.timestamp ?? null,
    lastAttemptAt: recentLogs[0]?.timestamp ?? null,
    lastOutcome: recentLogs[0]?.outcome ?? null,
    recentErrorCount: recentLogs.filter((log) => log.outcome === "error")
      .length,
    recentAttemptCount: recentLogs.length,
  };
}

export interface MatchDiagnosticSummary {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  /** ISO 8601. */
  kickoff: string;
  status: MatchStatus;
  normalizationStatus: "pending" | "normalized" | "flagged";
  warningFlag: string | null;
}

/**
 * Every match in a tournament (not just flagged ones, unlike
 * `getFlaggedMatches` above) — the browsable list backing UX-BLUEPRINT.md §4
 * screen #3, so an admin can drill into any match's raw-vs-normalized data,
 * not only the ones that were auto-flagged.
 */
export async function getMatchDiagnosticsList(
  tournamentId: string,
  limit = 200,
): Promise<MatchDiagnosticSummary[]> {
  const homeTeams = alias(teams, "home_teams");
  const awayTeams = alias(teams, "away_teams");

  const rows = await db
    .select({
      id: matches.id,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      kickoff: matches.kickoff,
      status: matches.status,
      normalizationStatus: matches.normalizationStatus,
      warningFlag: matches.warningFlag,
    })
    .from(matches)
    .innerJoin(homeTeams, eq(matches.homeTeamId, homeTeams.id))
    .innerJoin(awayTeams, eq(matches.awayTeamId, awayTeams.id))
    .where(eq(matches.tournamentId, tournamentId))
    .orderBy(desc(matches.kickoff))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    kickoff: row.kickoff.toISOString(),
  }));
}

export interface MatchDiagnosticDetail {
  id: string;
  /** Returned so the caller (the `[matchId]` admin page) can re-verify the
   * requesting admin actually administers *this* match's tournament — the
   * route only has a bare matchId, not a tournamentId, to start from. */
  tournamentId: string;
  homeTeamName: string;
  awayTeamName: string;
  /** External provider's match id, or null for a manually-entered match. */
  providerId: string | null;
  stage: string;
  status: MatchStatus;
  /** ISO 8601. */
  kickoff: string;
  /** ISO 8601. */
  lockTime: string;
  regularResult: MatchScore | null;
  extraTimeResult: MatchScore | null;
  penaltyResult: MatchScore | null;
  liveScore: MatchScore | null;
  /** "home" | "away" | "draw" | null while undecided. */
  winner: string | null;
  /** Raw, as-received provider payload — null for a manually-entered match. */
  rawProviderPayload: unknown;
  /** ISO 8601, or null if never synced (manually-entered match). */
  lastSyncedAt: string | null;
  normalizationStatus: "pending" | "normalized" | "flagged";
  warningFlag: string | null;
}

/**
 * Full raw-vs-normalized detail for one match (UX-BLUEPRINT.md §4 screen #3:
 * "Per-match raw provider payload vs. normalized canonical result,
 * contradiction warnings"). Deliberately keyed by matchId alone, not
 * matchId+tournamentId — see `MatchDiagnosticDetail.tournamentId`'s doc
 * comment for why the caller re-derives and re-checks the tournament from
 * the returned row.
 */
export async function getMatchDiagnostic(
  matchId: string,
): Promise<MatchDiagnosticDetail | null> {
  const homeTeams = alias(teams, "home_teams");
  const awayTeams = alias(teams, "away_teams");

  const rows = await db
    .select({
      id: matches.id,
      tournamentId: matches.tournamentId,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      providerId: matches.providerId,
      stage: matches.stage,
      status: matches.status,
      kickoff: matches.kickoff,
      lockTime: matches.lockTime,
      regularResult: matches.regularResult,
      extraTimeResult: matches.extraTimeResult,
      penaltyResult: matches.penaltyResult,
      liveScore: matches.liveScore,
      winner: matches.winner,
      rawProviderPayload: matches.rawProviderPayload,
      lastSyncedAt: matches.lastSyncedAt,
      normalizationStatus: matches.normalizationStatus,
      warningFlag: matches.warningFlag,
    })
    .from(matches)
    .innerJoin(homeTeams, eq(matches.homeTeamId, homeTeams.id))
    .innerJoin(awayTeams, eq(matches.awayTeamId, awayTeams.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    kickoff: row.kickoff.toISOString(),
    lockTime: row.lockTime.toISOString(),
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  };
}
