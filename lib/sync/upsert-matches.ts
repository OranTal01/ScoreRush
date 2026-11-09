/**
 * Writes `CanonicalMatch` records (produced by `lib/providers`) into the
 * `teams`/`matches` tables. This is the "raw storage -> ... -> canonical
 * result" pipeline's final step before scoring (ARCHITECTURE.md §5) — it
 * never talks to a provider directly, only to already-normalized data, so
 * it works identically for football-data.org and manual input.
 *
 * Runs with the service-role DB connection (`lib/db/client.ts`), which
 * connects as Postgres's `postgres` role and bypasses RLS — appropriate
 * here because a sync job is an authoritative, server-only write path, not
 * a participant-scoped request.
 */
import "server-only";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { matches, teams } from "@/lib/db/schema/competition";
import type { CanonicalMatch, CanonicalTeamRef } from "@/lib/providers/types";

type StoredMatch = typeof matches.$inferSelect;
export type UpsertContext = {
  teamIds: Map<string, string>;
  teamGroups: Map<string, string | null>;
  matchesByProvider: Map<string, StoredMatch>;
};
const teamKey = (ref: CanonicalTeamRef) =>
  ref.providerId ? `provider:${ref.providerId}` : `name:${ref.name}`;
export async function loadUpsertContext(
  tournamentId: string,
): Promise<UpsertContext> {
  const [roster, fixtures] = await Promise.all([
    db.select().from(teams).where(eq(teams.tournamentId, tournamentId)),
    db.select().from(matches).where(eq(matches.tournamentId, tournamentId)),
  ]);
  return {
    teamIds: new Map(roster.map((team) => [teamKey(team), team.id])),
    teamGroups: new Map(roster.map((team) => [team.id, team.group])),
    matchesByProvider: new Map(
      fixtures
        .filter((match) => match.providerId)
        .map((match) => [match.providerId!, match]),
    ),
  };
}

export interface UpsertOutcome {
  matchId: string;
  created: boolean;
  /** Non-fatal notices from this specific upsert (e.g. a kickoff/lock-time conflict) — distinct from normalization warnings. */
  warnings: string[];
}

/**
 * Finds or creates the internal `teams` row for a canonical team reference.
 * Provider-sourced teams (`providerId` set) are matched/deduped on
 * `(tournamentId, providerId)`; manual teams (`providerId` null) are
 * matched on exact name — the closest thing to a stable key an admin form
 * can supply without a team picker (Phase 7).
 */
async function resolveTeamId(
  tournamentId: string,
  ref: CanonicalTeamRef,
  context?: UpsertContext,
): Promise<string> {
  const cached = context?.teamIds.get(teamKey(ref));
  if (cached) return cached;
  const existing = ref.providerId
    ? await db
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(
            eq(teams.tournamentId, tournamentId),
            eq(teams.providerId, ref.providerId),
          ),
        )
        .limit(1)
    : await db
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(eq(teams.tournamentId, tournamentId), eq(teams.name, ref.name)),
        )
        .limit(1);

  if (existing[0]) {
    context?.teamIds.set(teamKey(ref), existing[0].id);
    return existing[0].id;
  }

  const [created] = await db
    .insert(teams)
    .values({
      tournamentId,
      name: ref.name,
      shortName: ref.shortName,
      providerId: ref.providerId,
    })
    .returning({ id: teams.id });

  context?.teamIds.set(teamKey(ref), created.id);
  return created.id;
}

async function findExistingMatch(
  tournamentId: string,
  canonical: CanonicalMatch,
  homeTeamId: string,
  awayTeamId: string,
) {
  const rows = canonical.providerId
    ? await db
        .select()
        .from(matches)
        .where(
          and(
            eq(matches.tournamentId, tournamentId),
            eq(matches.providerId, canonical.providerId),
          ),
        )
        .limit(1)
    : // Manual matches have no providerId — dedupe on the same two teams at
      // the same kickoff instant, since an admin re-submitting the same
      // match (e.g. correcting a score) will resend all these fields identically.
      await db
        .select()
        .from(matches)
        .where(
          and(
            eq(matches.tournamentId, tournamentId),
            eq(matches.homeTeamId, homeTeamId),
            eq(matches.awayTeamId, awayTeamId),
            eq(matches.kickoff, new Date(canonical.kickoff)),
          ),
        )
        .limit(1);

  return rows[0] ?? null;
}

export async function upsertCanonicalMatch(
  tournamentId: string,
  canonical: CanonicalMatch,
  context?: UpsertContext,
  fetchedAt = new Date(),
): Promise<UpsertOutcome> {
  const warnings: string[] = [];
  const homeTeamId = await resolveTeamId(
    tournamentId,
    canonical.homeTeam,
    context,
  );
  const awayTeamId = await resolveTeamId(
    tournamentId,
    canonical.awayTeam,
    context,
  );
  const kickoff = new Date(canonical.kickoff);
  if (canonical.group !== null) {
    for (const teamId of [homeTeamId, awayTeamId]) {
      if (context?.teamGroups.get(teamId) === canonical.group) continue;
      context?.teamGroups.set(teamId, canonical.group);
      await db
        .update(teams)
        .set({ group: canonical.group })
        .where(eq(teams.id, teamId));
    }
  }

  const existing =
    context && canonical.providerId
      ? (context.matchesByProvider.get(canonical.providerId) ?? null)
      : await findExistingMatch(
          tournamentId,
          canonical,
          homeTeamId,
          awayTeamId,
        );

  const sharedFields = {
    stage: canonical.stage,
    group: canonical.group,
    matchday: canonical.matchday,
    homeTeamId,
    awayTeamId,
    kickoff,
    status: canonical.result.status,
    regularResult: canonical.result.regularResult,
    extraTimeResult: canonical.result.extraTimeResult,
    penaltyResult: canonical.result.penaltyResult,
    liveScore: canonical.result.liveScore,
    liveDetails: canonical.liveDetails ?? null,
    winner: canonical.result.winner,
    rawProviderPayload: canonical.rawProviderPayload,
    lastSyncedAt: fetchedAt,
    normalizationStatus: (canonical.warning ? "flagged" : "normalized") as
      "flagged" | "normalized",
    warningFlag: canonical.warning?.message ?? null,
  };

  if (!existing) {
    const [created] = await db
      .insert(matches)
      .values({
        tournamentId,
        providerId: canonical.providerId,
        // League rules: predictions close five minutes before kickoff.
        lockTime: new Date(kickoff.getTime() - 5 * 60_000),
        ...sharedFields,
      })
      .returning({ id: matches.id });
    return { matchId: created.id, created: true, warnings };
  }

  // Never silently move an admin-configured lock time. If lockTime still
  // equals the previously-stored kickoff, no one has customized it, so it's
  // safe to keep tracking a rescheduled kickoff; otherwise leave it and
  // surface a warning so a human notices the mismatch.
  // The database deadline trigger follows the latest tournament setting.
  // Do not write a deadline from this cached context: an admin may have
  // changed it while this provider sync was in flight.
  if (existing.kickoff.getTime() !== kickoff.getTime()) {
    if (
      existing.lockTime.getTime() === existing.kickoff.getTime() ||
      existing.lockTime.getTime() === existing.kickoff.getTime() - 5 * 60_000
    ) {
      // Automatic deadline adjustment is handled by the database trigger.
    } else {
      warnings.push(
        `match ${existing.id}: kickoff changed (${existing.kickoff.toISOString()} -> ${kickoff.toISOString()}) but lock_time was left as admin-configured (${existing.lockTime.toISOString()})`,
      );
    }
  }

  await db
    .update(matches)
    .set(sharedFields)
    .where(
      and(
        eq(matches.id, existing.id),
        sql`(${matches.lastSyncedAt} is null or ${lte(matches.lastSyncedAt, fetchedAt)})`,
        canonical.liveDetails?.sourceUpdatedAt
          ? sql`(${matches.liveDetails}->>'sourceUpdatedAt' is null or (${matches.liveDetails}->>'sourceUpdatedAt')::timestamptz <= ${canonical.liveDetails.sourceUpdatedAt}::timestamptz)`
          : undefined,
      ),
    );

  return { matchId: existing.id, created: false, warnings };
}
