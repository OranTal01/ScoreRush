// @vitest-environment node
// Explicit opt-in: every synthetic record and all migration DDL are rolled back.
import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
it.skipIf(process.env.SCORERUSH_LIVE_DB_TESTS !== "1")(
  "live events are durable, isolated, and never change awarded points",
  async () => {
    if (
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid")
        .hostname !== "yxnzukupayrhzwnbqibu.supabase.co"
    )
      throw new Error("Unexpected test target");
    const { db } = await import("@/lib/db/client");
    const {
      tournaments,
      participants,
      teams,
      matches,
      matchPredictions,
      liveMatchEvents,
      liveMatchState,
    } = await import("@/lib/db/schema");
    const { recordLiveEvents } = await import("./events");
    const rollback = new Error("rollback live verification");
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout='5s'`);
        const existing = await tx.execute(
          sql`select to_regclass('public.live_runtime') as name`,
        );
        if (!existing[0].name)
          await tx.execute(
            sql.raw(
              await readFile(
                "lib/db/migrations/0013_live_experience.sql",
                "utf8",
              ),
            ),
          );
        const owner = randomUUID(),
          friend = randomUUID(),
          outsider = randomUUID();
        for (const uid of [owner, friend, outsider])
          await tx.execute(
            sql`insert into auth.users(id,email,raw_user_meta_data) values(${uid},${`${uid}@example.invalid`},'{}'::jsonb)`,
          );
        const [cup] = await tx
          .insert(tournaments)
          .values({
            name: "Rollback live verification",
            competition: "custom",
            createdBy: owner,
          })
          .returning();
        const [a, b] = await tx
          .insert(participants)
          .values([
            {
              tournamentId: cup.id,
              userId: owner,
              displayName: "A",
              role: "tournament_admin",
            },
            { tournamentId: cup.id, userId: friend, displayName: "B" },
          ])
          .returning();
        const [home, away] = await tx
          .insert(teams)
          .values([
            {
              tournamentId: cup.id,
              name: "Home",
              shortName: "Home",
              providerId: "1",
            },
            {
              tournamentId: cup.id,
              name: "Away",
              shortName: "Away",
              providerId: "2",
            },
          ])
          .returning();
        const now = new Date();
        const details = {
          regulationScore: { home: 0, away: 0 },
          period: "REGULAR" as const,
          minute: 10,
          cards: [],
          sourceUpdatedAt: now.toISOString(),
        };
        const [game] = await tx
          .insert(matches)
          .values({
            tournamentId: cup.id,
            homeTeamId: home.id,
            awayTeamId: away.id,
            stage: "league_stage",
            matchday: 1,
            kickoff: new Date(+now - 600000),
            lockTime: new Date(+now - 900000),
            status: "live",
            normalizationStatus: "normalized",
            liveScore: { home: 0, away: 0 },
            liveDetails: details,
            lastSyncedAt: now,
          })
          .returning();
        await tx.insert(matchPredictions).values([
          {
            participantId: a.id,
            matchId: game.id,
            predictedHome: 1,
            predictedAway: 0,
          },
          {
            participantId: b.id,
            matchId: game.id,
            predictedHome: 0,
            predictedAway: 0,
          },
        ]);
        expect(await recordLiveEvents(cup.id, "events", now, tx)).toBe(0);
        const next = new Date(+now + 60000);
        await tx
          .update(matches)
          .set({
            liveScore: { home: 1, away: 0 },
            liveDetails: {
              ...details,
              regulationScore: { home: 1, away: 0 },
              sourceUpdatedAt: next.toISOString(),
            },
            lastSyncedAt: next,
          })
          .where(eq(matches.id, game.id));
        expect(await recordLiveEvents(cup.id, "events", next, tx)).toBe(1);
        expect(await recordLiveEvents(cup.id, "events", next, tx)).toBe(0);
        expect(
          (
            await tx
              .select()
              .from(liveMatchEvents)
              .where(eq(liveMatchEvents.tournamentId, cup.id))
          )[0].change.kind,
        ).toBe("goal");
        const correction = new Date(+next + 60000);
        await tx
          .update(matches)
          .set({
            liveScore: { home: 0, away: 0 },
            liveDetails: {
              ...details,
              sourceUpdatedAt: correction.toISOString(),
            },
            lastSyncedAt: correction,
          })
          .where(eq(matches.id, game.id));
        expect(await recordLiveEvents(cup.id, "events", correction, tx)).toBe(
          1,
        );
        expect(
          (
            await tx
              .select()
              .from(matchPredictions)
              .where(eq(matchPredictions.matchId, game.id))
          ).every((p) => p.pointsEarned === null),
        ).toBe(true);
        // Onboarding suppresses new events, even with a running match and a manager.
        await tx
          .update(tournaments)
          .set({ onboardingOpen: true })
          .where(eq(tournaments.id, cup.id));
        await tx
          .update(matches)
          .set({
            liveScore: { home: 1, away: 0 },
            lastSyncedAt: new Date(+correction + 60000),
          })
          .where(eq(matches.id, game.id));
        expect(
          await recordLiveEvents(
            cup.id,
            "events",
            new Date(+correction + 60000),
            tx,
          ),
        ).toBe(0);
        await tx.execute(
          sql`select set_config('request.jwt.claim.sub',${friend},true)`,
        );
        await tx.execute(sql.raw("set local role authenticated"));
        const totals = await tx.execute(
          sql`select * from public.live_score_totals(${cup.id}::uuid)`,
        );
        expect(totals.length).toBe(2);
        expect(totals.every((p) => p.match_points === 0)).toBe(true);
        expect(totals[0]).not.toHaveProperty("predicted_home");
        expect(
          (
            await tx.execute(
              sql`select id from live_match_events where tournament_id=${cup.id}`,
            )
          ).length,
        ).toBe(2);
        await expect(
          tx.transaction((sp) =>
            sp.execute(
              sql`update live_match_state set revision=999 where match_id=${game.id}`,
            ),
          ),
        ).rejects.toThrow();
        await tx.execute(
          sql`select set_config('request.jwt.claim.sub',${outsider},true)`,
        );
        expect(
          (
            await tx.execute(
              sql`select * from public.live_score_totals(${cup.id}::uuid)`,
            )
          ).length,
        ).toBe(0);
        expect(
          (
            await tx.execute(
              sql`select id from live_match_events where tournament_id=${cup.id}`,
            )
          ).length,
        ).toBe(0);
        await tx.execute(sql.raw("reset role"));
        await tx.execute(
          sql`select set_config('request.jwt.claim.sub','',true)`,
        );
        expect(
          (
            await tx
              .select()
              .from(liveMatchState)
              .where(eq(liveMatchState.matchId, game.id))
          )[0].revision,
        ).toBe(3);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  },
  90000,
);
