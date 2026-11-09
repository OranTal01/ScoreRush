import "server-only";
import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { matches, teams } from "@/lib/db/schema/competition";
import { tournaments, participants } from "@/lib/db/schema/identity";
import { liveMatchState, liveMatchEvents } from "@/lib/db/schema/live";
import { notificationRuntime, pushSubscriptions } from "@/lib/db/schema/push";
import { matchPredictions } from "@/lib/db/schema/predictions";
import { scoringRules } from "@/lib/db/schema/config";
import { allowsRetrospectiveEntry } from "@/lib/tournaments/onboarding";
import { detectLiveChanges, liveFresh } from "./changes";
import { describeLiveChange, predictionImpact } from "./messages";
import type { LiveAccess, LiveObservation } from "./types";
import { deliverPush } from "@/lib/notifications/push";
type LiveStore = Pick<typeof db, "select" | "insert" | "update" | "execute">;
/** Durable event detection is independent from push transport. A failed push
 * scan can resume recent events; each subscription claims each event once. */
export async function recordLiveEvents(
  tournamentId: string,
  access: LiveAccess,
  now = new Date(),
  tx?: LiveStore,
): Promise<number> {
  if (!tx)
    return db.transaction((store) =>
      recordLiveEvents(tournamentId, access, now, store),
    );
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${"live:" + tournamentId},0))`,
  );
  const [cup] = await tx
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  if (!cup) return 0;
  const games = await tx
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        gte(matches.kickoff, new Date(+now - 8 * 3600000)),
        lte(matches.kickoff, new Date(+now + 15 * 60000)),
      ),
    );
  const roster = await tx
    .select()
    .from(teams)
    .where(eq(teams.tournamentId, tournamentId));
  let count = 0;
  for (const game of games) {
    if (
      !game.lastSyncedAt ||
      !liveFresh(game.lastSyncedAt.toISOString(), +now, access) ||
      game.normalizationStatus !== "normalized" ||
      allowsRetrospectiveEntry(
        {
          onboarding_open: cup.onboardingOpen,
          onboarding_matchday: cup.onboardingMatchday,
        },
        game,
      )
    )
      continue;
    const [stored] = await tx
      .select()
      .from(liveMatchState)
      .where(eq(liveMatchState.matchId, game.id));
    const after: LiveObservation = {
      status: game.status,
      score:
        game.status === "finished"
          ? (game.extraTimeResult ?? game.regularResult)
          : game.liveScore,
      details: game.liveDetails,
      observedAt: game.lastSyncedAt.toISOString(),
    };
    if (
      stored &&
      Date.parse(stored.observation.observedAt) >= Date.parse(after.observedAt)
    )
      continue;
    if (
      stored?.observation.details?.sourceUpdatedAt &&
      after.details?.sourceUpdatedAt &&
      Date.parse(after.details.sourceUpdatedAt) <
        Date.parse(stored.observation.details.sourceUpdatedAt)
    )
      continue;
    const changes =
      access === "delayed"
        ? []
        : detectLiveChanges(stored?.observation ?? null, after);
    const revision = (stored?.revision ?? 0) + 1;
    const home = roster.find((t) => t.id === game.homeTeamId),
      away = roster.find((t) => t.id === game.awayTeamId);
    for (const [index, change] of changes.entries()) {
      if (
        access !== "events" &&
        ["red_card", "card_correction"].includes(change.kind)
      )
        continue;
      await tx
        .insert(liveMatchEvents)
        .values({
          tournamentId,
          matchId: game.id,
          eventKey: `${revision}:${index}`,
          change,
          description: describeLiveChange(
            change,
            home?.shortName ?? "בית",
            away?.shortName ?? "חוץ",
            home?.providerId ?? null,
          ),
          createdAt: now,
        })
        .onConflictDoNothing();
      count++;
    }
    // A temporarily folded bookings response must not reset the seen-card set.
    const observation =
      after.details &&
      after.details.cards === null &&
      stored?.observation.details?.cards
        ? {
            ...after,
            details: {
              ...after.details,
              cards: stored.observation.details.cards,
            },
          }
        : after;
    await tx
      .insert(liveMatchState)
      .values({ matchId: game.id, revision, observation })
      .onConflictDoUpdate({
        target: liveMatchState.matchId,
        set: { revision, observation },
      });
  }
  return count;
}
export async function sendLiveNotifications(
  tournamentId: string,
  access: LiveAccess,
  now = new Date(),
) {
  if (access === "delayed") return 0;
  const [runtime] = await db
    .select()
    .from(notificationRuntime)
    .where(eq(notificationRuntime.id, "push"));
  if (!runtime?.enabled) return 0;
  const [cup] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  if (!cup) return 0;
  const events = await db
    .select()
    .from(liveMatchEvents)
    .where(
      and(
        eq(liveMatchEvents.tournamentId, tournamentId),
        gte(liveMatchEvents.createdAt, new Date(+now - 120000)),
      ),
    )
    .orderBy(liveMatchEvents.createdAt);
  if (!events.length) return 0;
  const members = await db
    .select()
    .from(participants)
    .where(eq(participants.tournamentId, tournamentId));
  const subs = await db.select().from(pushSubscriptions);
  const [rules] = await db
    .select()
    .from(scoringRules)
    .where(eq(scoringRules.tournamentId, tournamentId))
    .orderBy(desc(scoringRules.version))
    .limit(1);
  if (!rules) return 0;
  let sent = 0;
  for (const event of events) {
    const [game] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, event.matchId));
    if (
      !game ||
      allowsRetrospectiveEntry(
        {
          onboarding_open: cup.onboardingOpen,
          onboarding_matchday: cup.onboardingMatchday,
        },
        game,
      ) ||
      game.lockTime > now
    )
      continue;
    const picks = await db
      .select()
      .from(matchPredictions)
      .where(eq(matchPredictions.matchId, event.matchId));
    for (const sub of subs) {
      const member = members.find((m) => m.userId === sub.userId);
      if (!member || sub.createdAt > event.createdAt) continue;
      const kind = event.change.kind;
      const wanted =
        kind === "finished"
          ? sub.preferences.finished
          : ["red_card", "card_correction"].includes(kind)
            ? access === "events" && sub.preferences.redCards
            : ["goal", "score_change"].includes(kind)
              ? sub.preferences.goals
              : false;
      if (!wanted) continue;
      const pick = picks.find((p) => p.participantId === member.id);
      const impact = predictionImpact(
        event.change,
        pick
          ? {
              home: pick.predictedHome,
              away: pick.predictedAway,
              isDefault: pick.isDefault,
            }
          : null,
        rules,
      );
      const result = await deliverPush(
        sub,
        kind === "finished" ? `finished:${event.matchId}` : `live:${event.id}`,
        {
          title: event.description,
          body: impact || cup.name,
          url: `/api/push/open?tournament=${tournamentId}&next=${encodeURIComponent("/live")}`,
          tag: `live:${event.matchId}`,
        },
      );
      if (result === "sent") sent++;
    }
  }
  return sent;
}
