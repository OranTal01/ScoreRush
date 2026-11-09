/**
 * Scheduled sync entry point (ARCHITECTURE.md §7): "Vercel Cron hitting a
 * route handler" — this is that route handler. `vercel.json` wires a cron
 * schedule to it; Vercel automatically sends `Authorization: Bearer
 * $CRON_SECRET` on scheduled invocations when `CRON_SECRET` is set in the
 * project's environment, which `isAuthorized` below checks for.
 *
 * Fans out to `syncTournamentMatches` (lib/sync/run-sync.ts) for every
 * tournament that isn't `finished` yet — a finished tournament's results
 * don't change, so re-syncing it is a wasted call against football-data.org's
 * rate-limited free tier. Each tournament's sync is independent and already
 * catches its own errors (writing a `sync_logs` row regardless) — one
 * tournament failing must never stop the others from syncing.
 *
 * Immediately follows each tournament's sync with `recomputeTournamentScores`
 * (lib/scoring/recompute.ts, ROADMAP.md Phase 5 task #50) — new match
 * results are exactly what should trigger rescoring. Recompute runs
 * regardless of that tournament's sync outcome (rescoring against
 * already-stored data is harmless when sync fails) and its own failure is
 * caught independently so it never blocks sync's own result or the next
 * tournament in the loop.
 *
 * Immediately follows recompute with `captureLeaderboardSnapshot`
 * (lib/scoring/snapshots.ts, ROADMAP.md Phase 6 task #53) — new scored
 * points are exactly what should trigger a new leaderboard snapshot for
 * rank-movement history, and only recompute changes `points_earned`, so
 * "run right after recompute" is sufficient. Runs regardless of recompute's
 * own outcome (there may still be a previously-scored state worth
 * snapshotting) and its failure is caught independently for the same
 * one-tournament-must-not-block-the-rest reason as recompute above.
 *
 * Schedule (vercel.json): once daily. Vercel's Hobby plan restricts cron
 * jobs to at most one run/day — a Pro-plan upgrade or an external pinger
 * (e.g. a free GitHub Actions schedule, or cron-job.org) hitting this same
 * URL with the `CRON_SECRET` bearer token is how to get tighter-than-daily
 * syncing during a live matchday, without changing this handler.
 */
import "server-only";
import { recordLiveEvents } from "@/lib/live/events";
import { getLiveAccess } from "@/lib/live/access";
import { captureRoundHistory } from "@/lib/history/capture";
import { NextResponse } from "next/server";
import { eq, ne } from "drizzle-orm";
import { syncTournamentBonuses } from "@/lib/sync/bonus-stats";
import { fillMissingPredictions } from "@/lib/scoring/default-predictions";
import { db } from "@/lib/db/client";
import { tournaments } from "@/lib/db/schema/identity";
import { recomputeTournamentScores } from "@/lib/scoring/recompute";
import { captureLeaderboardSnapshot } from "@/lib/scoring/snapshots";
import { tournamentProviders } from "@/lib/db/schema/config";
import { syncTournamentMatches } from "@/lib/sync/run-sync";
import { processNotifications } from "@/lib/notifications/run";

// Always run fresh — this is a write path triggered by cron/an authorized
// caller, never something to cache.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed in every environment: this endpoint writes authoritative scores.
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      status: tournaments.status,
    })
    .from(tournaments)
    .innerJoin(
      tournamentProviders,
      eq(tournamentProviders.tournamentId, tournaments.id),
    )
    .where(ne(tournaments.status, "finished"));

  const results = [];
  const summaryTournamentIds: string[] = [];
  for (const row of rows) {
    const syncResult = await syncTournamentMatches(row.id);
    const bonusSync = await syncTournamentBonuses(row.id);

    let recompute: Awaited<
      ReturnType<typeof recomputeTournamentScores>
    > | null = null;
    let recomputeError: string | null = null;
    try {
      await fillMissingPredictions(row.id);
      recompute = await recomputeTournamentScores(row.id);
    } catch (err) {
      recomputeError = err instanceof Error ? err.message : String(err);
    }

    let snapshot: Awaited<
      ReturnType<typeof captureLeaderboardSnapshot>
    > | null = null;
    let snapshotError: string | null = null;
    try {
      if (!recomputeError) snapshot = await captureLeaderboardSnapshot(row.id);
    } catch (err) {
      snapshotError = err instanceof Error ? err.message : String(err);
    }

    if (syncResult.outcome === "success") {
      try {
        await recordLiveEvents(row.id, await getLiveAccess(row.id));
      } catch {
        /* The fast sync resumes recent event detection independently. */
      }
    }
    let history: unknown = null;
    if (syncResult.outcome === "success" && !recomputeError && !snapshotError) {
      summaryTournamentIds.push(row.id);
      try {
        history = await captureRoundHistory(row.id);
      } catch {
        history = { error: "Round history capture failed" };
      }
    }
    results.push({
      name: row.name,
      status: row.status,
      ...syncResult,
      bonusSync,
      recompute,
      recomputeError,
      snapshot,
      snapshotError,
      history,
    });
  }

  let notificationResult: unknown = null;
  try {
    notificationResult = await processNotifications(summaryTournamentIds);
  } catch {
    notificationResult = { error: "Notification processing failed" };
  }
  return NextResponse.json({
    notificationResult,
    syncedAt: new Date().toISOString(),
    tournamentsSynced: results.length,
    results,
  });
}
