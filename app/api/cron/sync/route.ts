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
 * Schedule (vercel.json): once daily. Vercel's Hobby plan restricts cron
 * jobs to at most one run/day — a Pro-plan upgrade or an external pinger
 * (e.g. a free GitHub Actions schedule, or cron-job.org) hitting this same
 * URL with the `CRON_SECRET` bearer token is how to get tighter-than-daily
 * syncing during a live matchday, without changing this handler.
 */
import "server-only";
import { NextResponse } from "next/server";
import { ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tournaments } from "@/lib/db/schema/identity";
import { recomputeTournamentScores } from "@/lib/scoring/recompute";
import { syncTournamentMatches } from "@/lib/sync/run-sync";

// Always run fresh — this is a write path triggered by cron/an authorized
// caller, never something to cache.
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured: nothing to check against, so allow — this is the
  // pre-setup local-dev state, not a production posture. CRON_SECRET must be
  // set in every deployed environment (see .env.local.example).
  if (!secret) return true;
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
    .where(ne(tournaments.status, "finished"));

  const results = [];
  for (const row of rows) {
    const syncResult = await syncTournamentMatches(row.id);

    let recompute: Awaited<ReturnType<typeof recomputeTournamentScores>> | null =
      null;
    let recomputeError: string | null = null;
    try {
      recompute = await recomputeTournamentScores(row.id);
    } catch (err) {
      recomputeError = err instanceof Error ? err.message : String(err);
    }

    results.push({
      name: row.name,
      status: row.status,
      ...syncResult,
      recompute,
      recomputeError,
    });
  }

  return NextResponse.json({
    syncedAt: new Date().toISOString(),
    tournamentsSynced: results.length,
    results,
  });
}
