/**
 * Read-side query backing the audit log viewer (UX-BLUEPRINT.md §4 screen
 * #11: "Full chronological log of all admin actions in the tournament",
 * Phase 7 task #62). Merges two FK-uncorrelated, time-correlated tables
 * (DATABASE.md §7, lib/db/schema/audit.ts):
 *
 * - `admin_overrides` — the human action record: reason, evidence, acting
 *   admin, reversible flag. Not tied to a specific entity/field.
 * - `score_audit_logs` — the field-level machine record: entity/field
 *   before/after values.
 *
 * Both rows are written by the same action inside the same transaction
 * (e.g. applyMatchCorrection, Phase 7 task #61's
 * app/(app)/admin/overrides/[matchId]/actions.ts), but there is no FK
 * between them by design — see that action's doc comment. This module
 * doesn't attempt to re-correlate them beyond sorting both into one
 * timeline; each entry stays fully self-describing.
 *
 * Both tables are admin-of-the-tournament-only per DATABASE.md §5's RLS
 * table. Matching lib/sync/diagnostics.ts's precedent, this module uses the
 * service-role client and takes an explicit tournamentId, since it exists
 * to serve one already-authorized admin's own tournament page — without the
 * explicit filter, the service-role client would happily return every
 * tournament's rows.
 */
import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import { adminOverrides, scoreAuditLogs } from "@/lib/db/schema/audit";
import { matches, teams } from "@/lib/db/schema/competition";
import { users } from "@/lib/db/schema/identity";

export interface OverrideAuditEntry {
  type: "override";
  id: string;
  /** ISO 8601. */
  timestamp: string;
  actingAdminName: string;
  reason: string;
  evidenceRef: string | null;
  reversible: boolean;
  /** ISO 8601, or null if never reversed. */
  reversedAt: string | null;
}

export interface ScoreChangeAuditEntry {
  type: "score_change";
  id: string;
  /** ISO 8601. */
  timestamp: string;
  actingAdminName: string;
  reason: string;
  /** e.g. "match" — see applyMatchCorrection for the only writer today. */
  entity: string;
  entityId: string;
  /** e.g. "regular_result" | "winner". */
  field: string;
  previousValue: unknown;
  newValue: unknown;
  /** Team names for entityId, when entity is "match" and the match still
   * exists — lets the UI show "Team A נגד Team B" instead of a bare UUID.
   * Null for any other entity, or if the match was somehow not found. */
  match: { homeTeamName: string; awayTeamName: string } | null;
}

export type AuditLogEntry = OverrideAuditEntry | ScoreChangeAuditEntry;

/**
 * Every admin override + score audit row for one tournament, newest first,
 * merged into a single chronological feed. Each source is capped
 * independently at `limitPerSource` (matches lib/sync/diagnostics.ts's
 * per-query limit pattern) before merging, so a burst in one table can't
 * starve the other out of the combined view.
 */
export async function getAuditLog(
  tournamentId: string,
  limitPerSource = 100,
): Promise<AuditLogEntry[]> {
  const [overrideRows, scoreChangeRows] = await Promise.all([
    db
      .select({
        id: adminOverrides.id,
        createdAt: adminOverrides.createdAt,
        actingAdminName: users.displayName,
        reason: adminOverrides.reason,
        evidenceRef: adminOverrides.evidenceRef,
        reversible: adminOverrides.reversible,
        reversedAt: adminOverrides.reversedAt,
      })
      .from(adminOverrides)
      .innerJoin(users, eq(adminOverrides.enteredBy, users.id))
      .where(eq(adminOverrides.tournamentId, tournamentId))
      .orderBy(desc(adminOverrides.createdAt))
      .limit(limitPerSource),
    db
      .select({
        id: scoreAuditLogs.id,
        createdAt: scoreAuditLogs.createdAt,
        actingAdminName: users.displayName,
        reason: scoreAuditLogs.reason,
        entity: scoreAuditLogs.entity,
        entityId: scoreAuditLogs.entityId,
        field: scoreAuditLogs.field,
        previousValue: scoreAuditLogs.previousValue,
        newValue: scoreAuditLogs.newValue,
      })
      .from(scoreAuditLogs)
      .innerJoin(users, eq(scoreAuditLogs.actingUserId, users.id))
      .where(eq(scoreAuditLogs.tournamentId, tournamentId))
      .orderBy(desc(scoreAuditLogs.createdAt))
      .limit(limitPerSource),
  ]);

  const matchEntityIds = [
    ...new Set(
      scoreChangeRows
        .filter((row) => row.entity === "match")
        .map((row) => row.entityId),
    ),
  ];
  const matchLabels = await getMatchLabels(matchEntityIds);

  const overrideEntries: OverrideAuditEntry[] = overrideRows.map((row) => ({
    type: "override",
    id: row.id,
    timestamp: row.createdAt.toISOString(),
    actingAdminName: row.actingAdminName,
    reason: row.reason,
    evidenceRef: row.evidenceRef,
    reversible: row.reversible,
    reversedAt: row.reversedAt?.toISOString() ?? null,
  }));

  const scoreChangeEntries: ScoreChangeAuditEntry[] = scoreChangeRows.map(
    (row) => ({
      type: "score_change",
      id: row.id,
      timestamp: row.createdAt.toISOString(),
      actingAdminName: row.actingAdminName,
      reason: row.reason,
      entity: row.entity,
      entityId: row.entityId,
      field: row.field,
      previousValue: row.previousValue,
      newValue: row.newValue,
      match:
        row.entity === "match" ? (matchLabels.get(row.entityId) ?? null) : null,
    }),
  );

  return [...overrideEntries, ...scoreChangeEntries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/** Home/away team names for each of the given match ids that still exist. */
async function getMatchLabels(
  matchIds: string[],
): Promise<Map<string, { homeTeamName: string; awayTeamName: string }>> {
  if (matchIds.length === 0) return new Map();

  const homeTeams = alias(teams, "home_teams");
  const awayTeams = alias(teams, "away_teams");

  const rows = await db
    .select({
      id: matches.id,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
    })
    .from(matches)
    .innerJoin(homeTeams, eq(matches.homeTeamId, homeTeams.id))
    .innerJoin(awayTeams, eq(matches.awayTeamId, awayTeams.id))
    .where(inArray(matches.id, matchIds))
    // matchIds is already deduped by the caller, so this is just a defensive
    // cap, not a real pagination limit — mirrors the rest of this codebase's
    // query style (lib/sync/diagnostics.ts) of always terminating in .limit().
    .limit(matchIds.length);

  return new Map(
    rows.map((row) => [
      row.id,
      { homeTeamName: row.homeTeamName, awayTeamName: row.awayTeamName },
    ]),
  );
}
