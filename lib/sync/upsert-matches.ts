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
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { matches, teams } from "@/lib/db/schema/competition";
import type { CanonicalMatch, CanonicalTeamRef } from "@/lib/providers/types";

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
): Promise<string> {
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

  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(teams)
    .values({
      tournamentId,
      name: ref.name,
      shortName: ref.shortName,
      providerId: ref.providerId,
    })
    .returning({ id: teams.id });

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
): Promise<UpsertOutcome> {
  const warnings: string[] = [];
  const homeTeamId = await resolveTeamId(tournamentId, canonical.homeTeam);
  const awayTeamId = await resolveTeamId(tournamentId, canonical.awayTeam);
  const kickoff = new Date(canonical.kickoff);

  const existing = await findExistingMatch(
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
    winner: canonical.result.winner,
    rawProviderPayload: canonical.rawProviderPayload,
    lastSyncedAt: new Date(),
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
        // MVP default: predictions lock exactly at kickoff. Phase 7 will
        // make lock-time policy admin-configurable per tournament; until
        // then this is the only sane default (UX-BLUEPRINT.md §12).
        lockTime: kickoff,
        ...sharedFields,
      })
      .returning({ id: matches.id });
    return { matchId: created.id, created: true, warnings };
  }

  // Never silently move an admin-configured lock time. If lockTime still
  // equals the previously-stored kickoff, no one has customized it, so it's
  // safe to keep tracking a rescheduled kickoff; otherwise leave it and
  // surface a warning so a human notices the mismatch.
  let lockTime = existing.lockTime;
  if (existing.kickoff.getTime() !== kickoff.getTime()) {
    if (existing.lockTime.getTime() === existing.kickoff.getTime()) {
      lockTime = kickoff;
    } else {
      warnings.push(
        `match ${existing.id}: kickoff changed (${existing.kickoff.toISOString()} -> ${kickoff.toISOString()}) but lock_time was left as admin-configured (${existing.lockTime.toISOString()})`,
      );
    }
  }

  await db
    .update(matches)
    .set({ ...sharedFields, lockTime })
    .where(eq(matches.id, existing.id));

  return { matchId: existing.id, created: false, warnings };
}
