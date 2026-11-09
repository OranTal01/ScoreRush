import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bonusCategories, tournamentProviders } from "@/lib/db/schema/config";
import { bonusStats } from "@/lib/db/schema/predictions";
import { matches, teams } from "@/lib/db/schema/competition";
import { tournaments } from "@/lib/db/schema/identity";
import { isGroupStageComplete } from "@/lib/scoring/group-standings";
import { getOfficialLeagueOrder } from "@/lib/scoring/official-league-order";
import { deriveTeamBonuses } from "@/lib/scoring/team-bonuses";
import { syncLogs, systemEvents } from "@/lib/db/schema/audit";
import { getBonusStatsAdapter } from "@/lib/providers";
import type { ProviderConfig } from "@/lib/providers/types";

/** Publish a complete validated snapshot atomically. Invalid/empty provider
 * responses retain the previous valid snapshot and are recorded for the admin. */
export async function syncTournamentBonuses(tournamentId: string) {
  const started = Date.now();
  try {
    const [binding] = await db
      .select()
      .from(tournamentProviders)
      .where(eq(tournamentProviders.tournamentId, tournamentId))
      .limit(1);
    if (!binding) throw new Error("No bonus provider configured");
    const adapter = getBonusStatsAdapter(binding.bonusStatsProvider);
    if (!adapter) throw new Error("Unknown bonus provider");
    const config = (binding.bonusStatsConfig ?? {}) as ProviderConfig;
    const result = await adapter.fetchBonusStats({ ...config, limit: 500 });
    if (result.warnings.length)
      throw new Error(result.warnings.map((w) => w.message).join("; "));
    const tournamentMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.tournamentId, tournamentId));
    const roster = await db
      .select()
      .from(teams)
      .where(eq(teams.tournamentId, tournamentId));
    result.stats.push(...deriveTeamBonuses(tournamentMatches, roster));
    const categories = await db
      .select()
      .from(bonusCategories)
      .where(eq(bonusCategories.tournamentId, tournamentId));
    const bindings = (config.categoryStatKeys ?? {}) as Record<string, string>;
    if (
      Object.values(bindings).includes("league_winner") &&
      tournamentMatches.some((match) => match.group === "league") &&
      isGroupStageComplete(tournamentMatches)
    ) {
      const order = await getOfficialLeagueOrder(tournamentId);
      const winner = roster.find((team) => team.id === order[0]);
      if (!winner)
        throw new Error("League winner missing from official roster");
      result.stats.push({
        statKey: "league_winner",
        entries: [
          {
            refId: winner.providerId ?? winner.id,
            label: winner.name,
            value: 1,
            rank: 1,
          },
        ],
      });
    }
    let updated = 0;
    for (const category of categories) {
      const statKey = bindings[category.id];
      if (!statKey) continue;
      // /scorers is not proof of complete assist coverage: never rank the
      // whole competition's assists from a goals-filtered subset by default.
      if (statKey === "top_assists" && config.assistsCoverageVerified !== true)
        continue;
      const entries = result.stats.find((s) => s.statKey === statKey)?.entries;
      if (!entries?.length || !entries.some((entry) => entry.value > 0))
        continue;
      const eventType = `bonus_snapshot:${category.id}`;
      const [previous] = await db
        .select()
        .from(systemEvents)
        .where(
          and(
            eq(systemEvents.tournamentId, tournamentId),
            eq(systemEvents.type, eventType),
          ),
        )
        .orderBy(desc(systemEvents.createdAt))
        .limit(1);
      if (JSON.stringify(previous?.payload) === JSON.stringify(entries))
        continue;
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${"scoring:" + tournamentId},0))`,
        );
        const [currentBinding] = await tx
          .select()
          .from(tournamentProviders)
          .where(eq(tournamentProviders.tournamentId, tournamentId));
        const currentKeys = (
          currentBinding?.bonusStatsConfig as {
            categoryStatKeys?: Record<string, string>;
          } | null
        )?.categoryStatKeys;
        if (currentKeys?.[category.id] !== statKey) return;
        await tx
          .insert(systemEvents)
          .values({ tournamentId, type: eventType, payload: entries });
        await tx
          .delete(bonusStats)
          .where(eq(bonusStats.categoryId, category.id));
        await tx.insert(bonusStats).values(
          entries.map((entry) => ({
            ...entry,
            categoryId: category.id,
            source: binding.bonusStatsProvider,
          })),
        );
      });
      updated++;
    }
    if (
      result.stats.some((s) => s.statKey === "champion" && s.entries.length)
    ) {
      await db
        .update(tournaments)
        .set({ status: "finished" })
        .where(eq(tournaments.id, tournamentId));
    }
    await db.insert(syncLogs).values({
      tournamentId,
      provider: "bonus_stats",
      outcome: "success",
      durationMs: Date.now() - started,
    });
    return { updated, error: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bonus sync failed";
    await db.insert(syncLogs).values({
      tournamentId,
      provider: "bonus_stats",
      outcome: "error",
      durationMs: Date.now() - started,
      errorDetail: detail,
    });
    return { updated: 0, error: detail };
  }
}
