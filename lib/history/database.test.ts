// @vitest-environment node
// Explicit opt-in. Synthetic records and all DDL are rolled back, including on failure.
import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
it.skipIf(process.env.SCORERUSH_HISTORY_DB_TESTS !== "1")(
  "round closures and membership privacy work against real policies",
  async () => {
    if (
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid")
        .hostname !== "yxnzukupayrhzwnbqibu.supabase.co"
    )
      throw new Error("Unexpected verification project");
    const { db } = await import("@/lib/db/client");
    const {
      tournaments,
      participants,
      teams,
      matches,
      matchPredictions,
      roundHistory,
    } = await import("@/lib/db/schema");
    const { captureRoundHistory } = await import("./capture");
    const rollback = new Error("verification rollback");
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout='5s'`);
        const table = await tx.execute(
          sql`select to_regclass('public.round_history') as name`,
        );
        if (!table[0].name)
          await tx.execute(
            sql.raw(
              await readFile(
                "lib/db/migrations/0012_round_history.sql",
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
            name: "Rollback history verification",
            competition: "custom",
            createdBy: owner,
            onboardingOpen: true,
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
            { tournamentId: cup.id, name: "Home", shortName: "H" },
            { tournamentId: cup.id, name: "Away", shortName: "A" },
          ])
          .returning();
        const matchBase = {
          tournamentId: cup.id,
          homeTeamId: home.id,
          awayTeamId: away.id,
          stage: "league_stage",
          matchday: 1,
          kickoff: new Date(Date.now() - 86400000),
          lockTime: new Date(Date.now() - 86500000),
          status: "finished" as const,
          normalizationStatus: "normalized" as const,
          regularResult: { home: 2, away: 1 },
        };
        const [game] = await tx.insert(matches).values(matchBase).returning();
        await tx.insert(matchPredictions).values([
          {
            matchId: game.id,
            participantId: a.id,
            predictedHome: 2,
            predictedAway: 1,
            pointsEarned: 9,
            outcome: "exact",
          },
          {
            matchId: game.id,
            participantId: b.id,
            predictedHome: 2,
            predictedAway: 0,
            pointsEarned: 3,
            outcome: "winner",
          },
        ]);
        // First observation is while onboarding is open: register, never capture.
        expect(await captureRoundHistory(cup.id, tx)).toEqual({ captured: 0 });
        const [tracking] = await tx
          .select()
          .from(roundHistory)
          .where(eq(roundHistory.tournamentId, cup.id));
        expect(tracking.trackedOpen).toBe(true);
        expect(tracking.capturedAt).toBeNull();
        // Both a regular participant and the manager see only their own pick.
        for (const [uid, pid] of [
          [owner, a.id],
          [friend, b.id],
        ]) {
          await tx.execute(
            sql`select set_config('request.jwt.claim.sub',${uid},true)`,
          );
          await tx.execute(sql.raw("set local role authenticated"));
          expect(
            (
              await tx.execute(
                sql`select public.is_match_locked(${game.id}::uuid) as locked`,
              )
            )[0].locked,
          ).toBe(false);
          const visible = await tx.execute(
            sql`select participant_id from public.match_predictions where match_id=${game.id}`,
          );
          expect(visible.map((p) => p.participant_id)).toEqual([pid]);
          await tx.execute(sql.raw("reset role"));
        }
        await tx.execute(
          sql`select set_config('request.jwt.claim.sub','',true)`,
        );
        await tx
          .update(tournaments)
          .set({ onboardingOpen: false })
          .where(eq(tournaments.id, cup.id));
        expect(await captureRoundHistory(cup.id, tx)).toEqual({ captured: 1 });
        const [closed] = await tx
          .select()
          .from(roundHistory)
          .where(eq(roundHistory.id, tracking.id));
        expect(
          closed.standings?.map((p) => [
            p.name,
            p.rank,
            p.total,
            p.roundPoints,
          ]),
        ).toEqual([
          ["A", 1, 9, 9],
          ["B", 2, 3, 3],
        ]);
        expect(await captureRoundHistory(cup.id, tx)).toEqual({ captured: 0 });
        // Completed rounds first seen later are not backfilled with today's rank.
        await tx.insert(matches).values({ ...matchBase, matchday: 2 });
        expect(await captureRoundHistory(cup.id, tx)).toEqual({ captured: 0 });
        const old = await tx
          .select()
          .from(roundHistory)
          .where(eq(roundHistory.tournamentId, cup.id));
        expect(
          old.find((r) => r.roundKey === "league_stage:2")?.trackedOpen,
        ).toBe(false);
        // Later corrections leave the historical snapshot intact.
        await tx
          .update(matchPredictions)
          .set({ pointsEarned: 0 })
          .where(eq(matchPredictions.participantId, a.id));
        await captureRoundHistory(cup.id, tx);
        expect(
          (
            await tx
              .select()
              .from(roundHistory)
              .where(eq(roundHistory.id, closed.id))
          )[0].standings,
        ).toEqual(closed.standings);
        await tx.execute(
          sql`select set_config('request.jwt.claim.sub',${friend},true)`,
        );
        await tx.execute(sql.raw("set local role authenticated"));
        expect(
          (
            await tx.execute(
              sql`select participant_id from match_predictions where match_id=${game.id}`,
            )
          ).length,
        ).toBe(2);
        expect(
          (
            await tx.execute(
              sql`select id from round_history where tournament_id=${cup.id}`,
            )
          ).length,
        ).toBe(2);
        await expect(
          tx.transaction((sp) =>
            sp.execute(
              sql`update round_history set label='tamper' where id=${closed.id}`,
            ),
          ),
        ).rejects.toThrow();
        await tx.execute(
          sql`select set_config('request.jwt.claim.sub',${outsider},true)`,
        );
        expect(
          (
            await tx.execute(
              sql`select id from round_history where tournament_id=${cup.id}`,
            )
          ).length,
        ).toBe(0);
        expect(
          (
            await tx.execute(
              sql`select id from match_predictions where match_id=${game.id}`,
            )
          ).length,
        ).toBe(0);
        await tx.execute(sql.raw("reset role"));
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  },
  90000,
);
