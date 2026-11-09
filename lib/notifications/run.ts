import "server-only";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { matches } from "@/lib/db/schema/competition";
import { participants, tournaments } from "@/lib/db/schema/identity";
import { matchPredictions } from "@/lib/db/schema/predictions";
import {
  notificationRuntime,
  pushSubscriptions,
  tournamentDigests,
  type DigestStanding,
} from "@/lib/db/schema/push";
import { computeStandings } from "@/lib/scoring/leaderboard";
import { buildDigest } from "./digest";
import { deliverPush } from "./push";
import { israelDay, reminderWindow, isMissingPrediction } from "./policy";

async function standings(
  tournamentId: string,
  matchIds: string[],
): Promise<DigestStanding[]> {
  // Aggregate each prediction table separately to avoid multiplying rows on joins.
  const rows = await db.execute(sql`select p.id, p.display_name as name,
    coalesce((select sum(points_earned) from match_predictions where participant_id=p.id),0)::int as mp,
    coalesce((select sum(points_earned) from group_predictions where participant_id=p.id),0)::int as gp,
    coalesce((select sum(points_earned) from bonus_predictions where participant_id=p.id),0)::int as bp
    from participants p where p.tournament_id=${tournamentId}`);
  const scores = computeStandings(
    rows.map((r) => ({
      participantId: String(r.id),
      matchPoints: Number(r.mp),
      groupRankingPoints: Number(r.gp),
      bonusPoints: Number(r.bp),
    })),
  );
  const daily = matchIds.length
    ? await db
        .select()
        .from(matchPredictions)
        .where(
          sql`${matchPredictions.matchId} in (${sql.join(
            matchIds.map((id) => sql`${id}::uuid`),
            sql`,`,
          )})`,
        )
    : [];
  return scores.map((s) => ({
    id: s.participantId,
    name: String(rows.find((r) => r.id === s.participantId)?.name ?? "משתתף"),
    rank: s.rank,
    total: s.totalPoints,
    gained: daily
      .filter((p) => p.participantId === s.participantId)
      .reduce((sum, p) => sum + (p.pointsEarned ?? 0), 0),
    exact: daily.filter(
      (p) =>
        p.participantId === s.participantId &&
        p.outcome === "exact" &&
        !p.isDefault,
    ).length,
  }));
}

/** Safe to invoke repeatedly. Only a successful scoring pass may publish a digest. */
export async function processNotifications(
  summaryTournamentIds: string[] = [],
  now = new Date(),
) {
  const [runtime] = await db
    .select()
    .from(notificationRuntime)
    .where(eq(notificationRuntime.id, "push"));
  if (!runtime?.enabled || !process.env.VAPID_PRIVATE_KEY)
    return { enabled: false };
  const fixtures = await db
    .select()
    .from(matches)
    .where(
      and(
        gte(matches.kickoff, new Date(now.getTime() - 72 * 3600000)),
        lte(matches.kickoff, new Date(now.getTime() + 48 * 3600000)),
      ),
    );
  const subs = await db.select().from(pushSubscriptions);
  const members = await db.select().from(participants);
  const cups = await db.select().from(tournaments);
  let sent = 0;
  const grouped = new Map<string, typeof fixtures>();
  for (const match of fixtures) {
    const key = `${match.tournamentId}:${israelDay(match.kickoff)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), match]);
  }
  for (const [key, games] of grouped) {
    const tournamentId = games[0].tournamentId,
      day = key.slice(tournamentId.length + 1);
    const destination = (path: string) =>
      `/api/push/open?tournament=${tournamentId}&next=${encodeURIComponent(path)}`;
    const active = games.filter(
      (m) => m.status !== "postponed" && m.status !== "cancelled",
    );
    if (!active.length) continue;
    const first = new Date(Math.min(...active.map((m) => m.kickoff.getTime())));
    const last = new Date(Math.max(...active.map((m) => m.kickoff.getTime())));
    // No retrospective announcements for results that predate activation.
    if (
      first < runtime.enabledAt ||
      first.getTime() < now.getTime() - 36 * 3600000
    )
      continue;
    const cup = cups.find((c) => c.id === tournamentId);
    if (!cup) continue;
    const relevantSubs = subs.filter((s) =>
      members.some(
        (p) => p.userId === s.userId && p.tournamentId === tournamentId,
      ),
    );
    const [existing] = await db
      .select()
      .from(tournamentDigests)
      .where(
        and(
          eq(tournamentDigests.tournamentId, tournamentId),
          eq(tournamentDigests.day, day),
        ),
      );
    if (first > now) {
      const baseline = await standings(tournamentId, []);
      await db
        .insert(tournamentDigests)
        .values({ tournamentId, day, baseline })
        .onConflictDoUpdate({
          target: [tournamentDigests.tournamentId, tournamentDigests.day],
          set: { baseline },
          setWhere: sql`${tournamentDigests.publishedAt} is null`,
        });
    }
    const firstLock = new Date(
      Math.min(...active.map((m) => m.lockTime.getTime())),
    );
    const window = reminderWindow(now, firstLock);
    const picks = window
      ? await db
          .select()
          .from(matchPredictions)
          .where(
            sql`${matchPredictions.matchId} in (${sql.join(
              active.map((m) => sql`${m.id}::uuid`),
              sql`,`,
            )})`,
          )
      : [];
    for (const sub of relevantSubs) {
      const member = members.find(
        (p) => p.userId === sub.userId && p.tournamentId === tournamentId,
      )!;
      if (window && sub.preferences.reminders) {
        const missing = active.filter(
          (m) =>
            m.status === "scheduled" &&
            m.lockTime > now &&
            isMissingPrediction(
              picks.find(
                (p) => p.matchId === m.id && p.participantId === member.id,
              ),
            ),
        );
        if (missing.length) {
          const result = await deliverPush(sub, `${key}:reminder:${window}`, {
            title:
              window === "day-before"
                ? "מחר משחקים — הניחושים שלכם מוכנים? ⚽"
                : "המשחקים מתקרבים ⏰",
            body: `${cup.name}: נשארו לכם ${missing.length} ניחושים למלא.`,
            url: destination(`/predictions/${missing[0].id}`),
            tag: `${key}:reminder`,
          });
          if (result === "sent") sent++;
        }
      }
      if (
        sub.preferences.kickoff &&
        now >= first &&
        now.getTime() - first.getTime() < 10 * 60000
      ) {
        if (
          (await deliverPush(sub, `${key}:kickoff`, {
            title: "ערב המשחקים יוצא לדרך ⚽",
            body: cup.name,
            url: destination("/predictions"),
            tag: `${key}:kickoff`,
          })) === "sent"
        )
          sent++;
      }
      if (
        sub.preferences.finished &&
        summaryTournamentIds.includes(tournamentId)
      ) {
        for (const match of active.filter(
          (m) =>
            m.status === "finished" &&
            m.regularResult &&
            m.kickoff >= sub.createdAt,
        )) {
          if (
            (await deliverPush(sub, `finished:${match.id}`, {
              title: "משחק הסתיים ⚽",
              body: "התוצאה והניקוד שלכם מחכים באתר.",
              url: destination(`/predictions/${match.id}`),
              tag: `finished:${match.id}`,
            })) === "sent"
          )
            sent++;
        }
      }
    }
    async function sendSummary(current: DigestStanding[], publishedAt: Date) {
      for (const sub of relevantSubs.filter(
        (s) => s.preferences.summaries && s.createdAt <= publishedAt,
      )) {
        const self = members.find(
          (p) => p.userId === sub.userId && p.tournamentId === tournamentId,
        );
        const score = current.find((p) => p.id === self?.id);
        if (
          (await deliverPush(sub, `${key}:summary`, {
            title: "הטבלה זזה — סיכום הערב מוכן 🏆",
            body: score
              ? `${score.name}, הוספת ${score.gained} נק׳ מהמשחקים. מקום ${score.rank} עם ${score.total} נק׳!`
              : cup!.name,
            url: destination("/summaries"),
            tag: `${key}:summary`,
          })) === "sent"
        )
          sent++;
      }
    }
    // A later scan resumes unclaimed deliveries after an interrupted run.
    if (existing?.publishedAt) {
      await sendSummary(existing.standings ?? [], existing.publishedAt);
      continue;
    }
    // Wait for every game in this evening and a second successful sync; never
    // publish partial scores, and never send a second summary for this day.
    if (
      !summaryTournamentIds.includes(tournamentId) ||
      !active.every((m) => m.status === "finished" && m.regularResult) ||
      now.getTime() - last.getTime() < 120 * 60000
    )
      continue;
    if (!existing?.readyAt) {
      await db
        .insert(tournamentDigests)
        .values({ tournamentId, day, readyAt: now })
        .onConflictDoUpdate({
          target: [tournamentDigests.tournamentId, tournamentDigests.day],
          set: { readyAt: now },
        });
      continue;
    }
    if (now.getTime() - existing.readyAt.getTime() < 10 * 60000) continue;
    const current = await standings(
      tournamentId,
      active.map((m) => m.id),
    );
    const body = buildDigest(
      cup.name,
      day,
      current,
      existing.baseline,
      active.length,
    );
    const [published] = await db
      .update(tournamentDigests)
      .set({ standings: current, body, publishedAt: now })
      .where(
        and(
          eq(tournamentDigests.id, existing.id),
          sql`${tournamentDigests.publishedAt} is null`,
        ),
      )
      .returning({ id: tournamentDigests.id });
    if (!published) continue;
    await sendSummary(current, now);
  }
  await db
    .update(notificationRuntime)
    .set({ lastRunAt: now })
    .where(eq(notificationRuntime.id, "push"));
  return { enabled: true, sent };
}
