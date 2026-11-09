// @vitest-environment node
// Opt-in integration test. All fixture changes and optional migration DDL
// are rolled back; no live tournament is edited or removed.
import { expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";

it.skipIf(process.env.SCORERUSH_DB_TESTS !== "1")(
  "settings edits, scoring, deadlines, isolation and deletion are atomic",
  async () => {
    const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
    if (
      target.hostname !== "127.0.0.1" ||
      target.port !== "55439" ||
      target.pathname !== "/scorerush_settings"
    )
      throw new Error(
        "This integration test may only run against the isolated local settings database",
      );
    const { db } = await import("@/lib/db/client");
    const { tournaments, participants, users } =
      await import("@/lib/db/schema/identity");
    const { matches, teams } = await import("@/lib/db/schema/competition");
    const { scoringRules, bonusCategories, bonusSlots, tournamentProviders } =
      await import("@/lib/db/schema/config");
    const {
      matchPredictions,
      groupPredictions,
      bonusPredictions,
      bonusStats,
      leaderboardSnapshots,
    } = await import("@/lib/db/schema/predictions");
    const {
      readTournamentSettings,
      writeTournamentSettings,
      removeTournament,
    } = await import("./settings-store");
    const rolledBack = new Error("verification rollback");
    await expect(
      db.transaction(async (tx) => {
        const existing = await tx.execute(
          sql`select 1 from information_schema.columns where table_schema='public' and table_name='tournaments' and column_name='settings_revision'`,
        );
        expect(existing.length).toBe(1);
        const [owner] = await tx
          .select()
          .from(users)
          .where(eq(users.email, "owner@scorerush.test"));
        expect(owner).toBeDefined();
        const [t, other] = await tx
          .insert(tournaments)
          .values([
            {
              name: "Settings verification",
              competition: "custom",
              createdBy: owner.id,
              status: "active",
            },
            {
              name: "Other verification",
              competition: "custom",
              createdBy: owner.id,
            },
          ])
          .returning();
        const [member] = await tx
          .insert(participants)
          .values({
            tournamentId: t.id,
            userId: owner.id,
            displayName: "Verification",
            role: "tournament_admin",
          })
          .returning();
        await tx
          .insert(scoringRules)
          .values([{ tournamentId: t.id }, { tournamentId: other.id }]);
        await tx.insert(tournamentProviders).values({
          tournamentId: t.id,
          matchDataProvider: "manual",
          bonusStatsProvider: "manual",
          bonusStatsConfig: { categoryStatKeys: {} },
        });
        const [home, away] = await tx
          .insert(teams)
          .values([
            { tournamentId: t.id, name: "Home", shortName: "H", group: "A" },
            { tournamentId: t.id, name: "Away", shortName: "A", group: "A" },
          ])
          .returning();
        const [done, future] = await tx
          .insert(matches)
          .values([
            {
              tournamentId: t.id,
              homeTeamId: home.id,
              awayTeamId: away.id,
              stage: "group",
              group: "A",
              status: "finished",
              kickoff: new Date("2026-01-01T18:00Z"),
              lockTime: new Date(),
              regularResult: { home: 2, away: 1 },
            },
            {
              tournamentId: t.id,
              homeTeamId: home.id,
              awayTeamId: away.id,
              stage: "group",
              group: "A",
              kickoff: new Date("2099-01-01T18:00Z"),
              lockTime: new Date(),
            },
          ])
          .returning();
        await tx.insert(matchPredictions).values({
          matchId: done.id,
          participantId: member.id,
          predictedHome: 2,
          predictedAway: 1,
        });
        await tx.insert(groupPredictions).values({
          tournamentId: t.id,
          participantId: member.id,
          group: "A",
          predictedOrder: [home.id, away.id],
        });
        const [cat] = await tx
          .insert(bonusCategories)
          .values({
            tournamentId: t.id,
            name: "Bonus",
            type: "team",
            resolvesAt: "ongoing",
          })
          .returning();
        const [slot] = await tx
          .insert(bonusSlots)
          .values({ categoryId: cat.id, slotIndex: 1, points: 20 })
          .returning();
        await tx.insert(bonusPredictions).values({
          categoryId: cat.id,
          slotId: slot.id,
          participantId: member.id,
          pickLabel: "Home",
          pickRefId: home.id,
        });
        await tx.insert(bonusStats).values({
          categoryId: cat.id,
          label: "Home",
          refId: home.id,
          value: 1,
          rank: 1,
        });
        const initial = await readTournamentSettings(t.id, true, tx);
        const edited = {
          ...initial.settings,
          name: "Edited verification",
          exactScorePoints: 12,
          matchLockMinutes: 15,
          categories: initial.settings.categories.map((c) => ({
            ...c,
            slots: c.slots.map((s) => ({ ...s, points: 25 })),
          })),
        };
        await writeTournamentSettings(edited, owner.id, "Verify scoring", tx);
        const after = await readTournamentSettings(t.id, true, tx);
        expect(after.settings.revision).toBe(1);
        const [mp] = await tx
          .select()
          .from(matchPredictions)
          .where(eq(matchPredictions.matchId, done.id));
        expect(mp.pointsEarned).toBe(12);
        const [bp] = await tx
          .select()
          .from(bonusPredictions)
          .where(eq(bonusPredictions.slotId, slot.id));
        expect(bp.pointsEarned).toBe(25);
        const [snapshot] = await tx
          .select()
          .from(leaderboardSnapshots)
          .where(eq(leaderboardSnapshots.tournamentId, t.id));
        expect(snapshot.totalPoints).toBe(37);
        const [next] = await tx
          .select()
          .from(matches)
          .where(eq(matches.id, future.id));
        expect(next.kickoff.getTime() - next.lockTime.getTime()).toBe(
          15 * 60000,
        );
        const rescheduled = new Date("2099-01-02T18:00Z");
        await tx
          .update(matches)
          .set({ kickoff: rescheduled })
          .where(eq(matches.id, future.id));
        const [moved] = await tx
          .select()
          .from(matches)
          .where(eq(matches.id, future.id));
        expect(moved.kickoff.getTime() - moved.lockTime.getTime()).toBe(
          15 * 60000,
        );
        const custom = new Date("2098-12-25T12:00Z");
        await tx
          .update(matches)
          .set({ lockTime: custom })
          .where(eq(matches.id, future.id));
        await tx
          .update(matches)
          .set({ kickoff: new Date("2099-01-03T18:00Z") })
          .where(eq(matches.id, future.id));
        const [customized] = await tx
          .select()
          .from(matches)
          .where(eq(matches.id, future.id));
        expect(customized.lockTime.getTime()).toBe(custom.getTime());
        await expect(
          writeTournamentSettings(edited, owner.id, "stale", tx),
        ).rejects.toThrow("ההגדרות השתנו");
        await expect(
          writeTournamentSettings(
            {
              ...after.settings,
              rankingConfig: { mode: "bands", sizes: [1, 1] },
            },
            owner.id,
            "structure",
            tx,
          ),
        ).rejects.toThrow("כבר הוזנו דירוגי");
        await expect(
          writeTournamentSettings(
            { ...after.settings, categories: [] },
            owner.id,
            "remove used",
            tx,
          ),
        ).rejects.toThrow("כבר הוזנו עבורה");
        const [unchanged] = await tx
          .select()
          .from(scoringRules)
          .where(eq(scoringRules.tournamentId, other.id));
        expect(unchanged.exactScorePoints).toBe(9);
        await expect(
          removeTournament(t.id, "wrong name", owner.id, tx),
        ).rejects.toThrow("אינו תואם");
        await removeTournament(t.id, after.settings.name, owner.id, tx);
        expect(
          await tx.select().from(tournaments).where(eq(tournaments.id, t.id)),
        ).toHaveLength(0);
        expect(
          await tx
            .select()
            .from(matchPredictions)
            .where(eq(matchPredictions.id, mp.id)),
        ).toHaveLength(0);
        expect(
          await tx
            .select()
            .from(tournaments)
            .where(eq(tournaments.id, other.id)),
        ).toHaveLength(1);
        expect(
          await tx
            .select()
            .from(users)
            .where(
              and(
                eq(users.id, owner.id),
                eq(users.email, "owner@scorerush.test"),
              ),
            ),
        ).toHaveLength(1);
        throw rolledBack;
      }),
    ).rejects.toBe(rolledBack);
  },
  180000,
);
