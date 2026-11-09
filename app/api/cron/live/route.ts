import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { liveRuntime } from "@/lib/db/schema/live";
import { syncTournamentMatches } from "@/lib/sync/run-sync";
import { recordLiveEvents, sendLiveNotifications } from "@/lib/live/events";
import { fillMissingPredictions } from "@/lib/scoring/default-predictions";
import { recomputeTournamentScores } from "@/lib/scoring/recompute";
import { captureLeaderboardSnapshot } from "@/lib/scoring/snapshots";
import { captureRoundHistory } from "@/lib/history/capture";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const now = new Date();
  const [runtime] = await db
    .update(liveRuntime)
    .set({ lastPollAt: now, pollingUntil: new Date(+now + 120000) })
    .where(
      and(
        eq(liveRuntime.provider, "football_data_org"),
        sql`${liveRuntime.access} <> 'delayed'`,
        sql`(${liveRuntime.pollingUntil} is null or ${liveRuntime.pollingUntil}<now())`,
        sql`(${liveRuntime.lastPollAt} is null or ${liveRuntime.lastPollAt}<now()-interval '50 seconds')`,
      ),
    )
    .returning();
  if (!runtime) return Response.json({ status: "inactive_or_running" });
  let events = 0,
    sent = 0;
  const errors: string[] = [];
  try {
    const cups = await db.execute(
      sql`select distinct t.id from tournaments t join tournament_providers p on p.tournament_id=t.id join matches m on m.tournament_id=t.id where t.status<>'finished' and p.match_data_provider='football_data_org' and m.kickoff between now()-interval '8 hours' and now()+interval '15 minutes' and m.status not in ('cancelled','postponed')`,
    );
    for (const cup of cups) {
      const id = String(cup.id);
      const signature = async () =>
        JSON.stringify(
          await db.execute(
            sql`select id,regular_result,normalization_status from matches where tournament_id=${id} and status='finished' order by id`,
          ),
        );
      const before = await signature();
      const result = await syncTournamentMatches(id, {
        from: new Date(+now - 86400000).toISOString().slice(0, 10),
        to: new Date(+now + 86400000).toISOString().slice(0, 10),
      });
      if (result.outcome !== "success") {
        errors.push("ספק המשחקים לא החזיר עדכון תקין");
        continue;
      }
      const [pending] = await db.execute(
        sql`select exists(select 1 from match_predictions p join matches m on m.id=p.match_id where m.tournament_id=${id} and m.status='finished' and m.regular_result is not null and p.points_earned is null) as unscored`,
      );
      if (
        before !== (await signature()) ||
        runtime.lastError ||
        pending?.unscored
      ) {
        await fillMissingPredictions(id);
        await recomputeTournamentScores(id);
        await captureLeaderboardSnapshot(id);
        await captureRoundHistory(id);
      }
      events += await recordLiveEvents(id, runtime.access);
      sent += await sendLiveNotifications(id, runtime.access);
    }
  } catch {
    errors.push("סנכרון הלייב לא הושלם");
  } finally {
    await db
      .update(liveRuntime)
      .set({ pollingUntil: null, lastError: errors.join("; ") || null })
      .where(
        and(
          eq(liveRuntime.provider, runtime.provider),
          eq(liveRuntime.lastPollAt, now),
        ),
      );
  }
  return Response.json(
    { events, sent, errors },
    { status: errors.length ? 503 : 200 },
  );
}
