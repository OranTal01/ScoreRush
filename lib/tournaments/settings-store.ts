import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tournaments, participants } from "@/lib/db/schema/identity";
import { matches, teams } from "@/lib/db/schema/competition";
import {
  scoringRules,
  bonusCategories,
  bonusSlots,
  prizes,
  tournamentProviders,
} from "@/lib/db/schema/config";
import {
  groupPredictions,
  bonusPredictions,
  bonusStats,
  matchPredictions,
} from "@/lib/db/schema/predictions";
import { scoreAuditLogs, systemEvents } from "@/lib/db/schema/audit";
import {
  DEFAULT_SCORING_RULES,
  recomputeTournamentScores,
} from "@/lib/scoring/recompute";
import { captureLeaderboardSnapshot } from "@/lib/scoring/snapshots";
import {
  settingsSchema,
  type SettingsView,
  type TournamentSettings,
} from "./settings-input";

type Store = Pick<
  typeof db,
  "select" | "insert" | "update" | "delete" | "execute"
>;
export class SettingsError extends Error {}
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

export async function readTournamentSettings(
  tournamentId: string,
  canDelete: boolean,
  store: Store = db,
): Promise<SettingsView> {
  const [t] = await store
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  if (!t) throw new SettingsError("הטורניר לא נמצא.");
  const [
    rules,
    categories,
    slots,
    rewards,
    members,
    fixtures,
    rankings,
    picks,
    binding,
  ] = await Promise.all([
    store
      .select()
      .from(scoringRules)
      .where(eq(scoringRules.tournamentId, tournamentId))
      .orderBy(desc(scoringRules.version))
      .limit(1),
    store
      .select()
      .from(bonusCategories)
      .where(eq(bonusCategories.tournamentId, tournamentId))
      .orderBy(asc(bonusCategories.sortOrder)),
    store
      .select({
        id: bonusSlots.id,
        categoryId: bonusSlots.categoryId,
        points: bonusSlots.points,
        slotIndex: bonusSlots.slotIndex,
      })
      .from(bonusSlots)
      .innerJoin(bonusCategories, eq(bonusCategories.id, bonusSlots.categoryId))
      .where(eq(bonusCategories.tournamentId, tournamentId))
      .orderBy(asc(bonusSlots.slotIndex)),
    store
      .select()
      .from(prizes)
      .where(eq(prizes.tournamentId, tournamentId))
      .orderBy(asc(prizes.rank)),
    store
      .select({ id: participants.id })
      .from(participants)
      .where(eq(participants.tournamentId, tournamentId)),
    store
      .select({ id: matches.id })
      .from(matches)
      .where(eq(matches.tournamentId, tournamentId)),
    store
      .select({ id: groupPredictions.id })
      .from(groupPredictions)
      .where(eq(groupPredictions.tournamentId, tournamentId)),
    store
      .select({ categoryId: bonusPredictions.categoryId })
      .from(bonusPredictions)
      .innerJoin(
        bonusCategories,
        eq(bonusPredictions.categoryId, bonusCategories.id),
      )
      .where(eq(bonusCategories.tournamentId, tournamentId)),
    store
      .select()
      .from(tournamentProviders)
      .where(eq(tournamentProviders.tournamentId, tournamentId))
      .limit(1),
  ]);
  const mp = await store
    .select({ n: sql<number>`count(*)::int` })
    .from(matchPredictions)
    .innerJoin(matches, eq(matches.id, matchPredictions.matchId))
    .where(eq(matches.tournamentId, tournamentId));
  const rule = rules[0];
  const mapping = object(object(binding[0]?.bonusStatsConfig).categoryStatKeys);
  const bonusPicks: Record<string, number> = {};
  for (const pick of picks)
    bonusPicks[pick.categoryId] = (bonusPicks[pick.categoryId] ?? 0) + 1;
  const settings = settingsSchema.parse({
    tournamentId,
    revision: t.settingsRevision,
    name: t.name,
    matchLockMinutes: t.matchLockMinutes,
    ...DEFAULT_SCORING_RULES,
    ...(rule
      ? {
          exactScorePoints: rule.exactScorePoints,
          winnerAndDiffPoints: rule.winnerAndDiffPoints,
          winnerOnlyPoints: rule.winnerOnlyPoints,
          wrongPoints: rule.wrongPoints,
          groupRankingPointsPerPosition: rule.groupRankingPointsPerPosition,
        }
      : {}),
    rankingConfig: rule?.rankingConfig ?? { mode: "exact" },
    rankingLocksAt: rule?.rankingLocksAt?.toISOString() ?? null,
    onboardingOpen: t.onboardingOpen,
    onboardingMatchday: t.onboardingMatchday,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      statKey: mapping[c.id] ?? "manual",
      resolvesAt: c.resolvesAt,
      duplicateStackingAllowed: c.duplicateStackingAllowed,
      locksAt: c.locksAt?.toISOString() ?? null,
      slots: slots
        .filter((s) => s.categoryId === c.id)
        .map((s) => ({ id: s.id, points: s.points })),
    })),
    prizes: rewards.map((p) => p.description),
  });
  return {
    settings,
    onboardingClosed: !!t.onboardingClosedAt,
    canDelete,
    counts: {
      participants: members.length,
      matches: fixtures.length,
      predictions: Number(mp[0]?.n ?? 0) + rankings.length + picks.length,
      rankings: rankings.length,
      bonusPicks,
    },
  };
}

export function assertCompatibleSettings(
  before: SettingsView,
  after: TournamentSettings,
) {
  const old = before.settings;
  if (old.revision !== after.revision)
    throw new SettingsError(
      "ההגדרות השתנו מאז שפתחת את המסך. רענן לפני עריכה נוספת.",
    );
  if (before.onboardingClosed && after.onboardingOpen)
    throw new SettingsError("תקופת הקליטה כבר נסגרה. לא ניתן לפתוח אותה מחדש.");
  if (old.onboardingOpen && !after.onboardingOpen)
    throw new SettingsError(
      "סגירת הקליטה מתבצעת בכפתור הייעודי, כדי להשלים ניחושי ברירת מחדל.",
    );
  if (
    before.counts.rankings > 0 &&
    JSON.stringify(old.rankingConfig) !== JSON.stringify(after.rankingConfig)
  )
    throw new SettingsError(
      "כבר הוזנו דירוגי קבוצות. ניתן לשנות את הניקוד, אך לא את שיטת הדירוג או גודל הטווחים.",
    );
  for (const cat of after.categories) {
    const previous = old.categories.find((c) => c.id === cat.id);
    if (cat.id && !previous)
      throw new SettingsError("קטגוריה אינה שייכת לטורניר.");
    if (
      cat.slots.some((s) => s.id && !previous?.slots.some((p) => p.id === s.id))
    )
      throw new SettingsError("אפשרות אינה שייכת לקטגוריה.");
    if (
      previous &&
      before.counts.bonusPicks[previous.id!] &&
      (previous.type !== cat.type ||
        previous.statKey !== cat.statKey ||
        previous.duplicateStackingAllowed !== cat.duplicateStackingAllowed ||
        JSON.stringify(previous.slots.map((s) => s.id)) !==
          JSON.stringify(cat.slots.map((s) => s.id)))
    )
      throw new SettingsError(
        `כבר הוזנו ניחושים עבור ״${previous.name}״. אפשר לערוך את השם, הניקוד והמועדים; מבנה האפשרויות וסוג הבונוס נשמרים.`,
      );
  }
  for (const cat of old.categories)
    if (
      !after.categories.some((c) => c.id === cat.id) &&
      before.counts.bonusPicks[cat.id!]
    )
      throw new SettingsError(
        `לא ניתן למחוק את ״${cat.name}״ כי כבר הוזנו עבורה ניחושים.`,
      );
}

export async function writeTournamentSettings(
  input: TournamentSettings,
  userId: string,
  reason: string,
  database: Pick<typeof db, "transaction"> = db,
) {
  await database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"scoring:" + input.tournamentId},0))`,
    );
    // Prevent a participant submitting a pick between structural validation
    // and deleting a now-empty slot/category. No picks are returned to the UI.
    await tx.execute(
      sql`lock table public.bonus_predictions, public.group_predictions, public.match_predictions in share row exclusive mode`,
    );
    await tx
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.id, input.tournamentId))
      .for("update");
    const before = await readTournamentSettings(input.tournamentId, false, tx);
    assertCompatibleSettings(before, input);
    if (input.rankingConfig.mode === "bands") {
      const roster = await tx
        .select({ group: teams.group, n: sql<number>`count(*)::int` })
        .from(teams)
        .where(eq(teams.tournamentId, input.tournamentId))
        .groupBy(teams.group);
      const total = input.rankingConfig.sizes.reduce((a, b) => a + b, 0);
      if (roster.some((g) => g.group && Number(g.n) !== total))
        throw new SettingsError(
          "סכום גודל הטווחים חייב להתאים למספר הקבוצות בכל בית או בשלב הליגה.",
        );
    }
    await tx
      .update(tournaments)
      .set({
        name: input.name,
        settingsRevision: input.revision + 1,
        matchLockMinutes: input.matchLockMinutes,
        onboardingOpen: input.onboardingOpen,
        onboardingMatchday: input.onboardingMatchday,
      })
      .where(eq(tournaments.id, input.tournamentId));
    if (before.settings.matchLockMinutes !== input.matchLockMinutes) {
      // Already locked fixtures stay locked; only upcoming, still-editable
      // matches adopt the new rule. The DB trigger handles future syncs.
      await tx
        .update(matches)
        .set({
          lockTime: sql`${matches.kickoff} - make_interval(mins => ${input.matchLockMinutes}::int)`,
        })
        .where(
          and(
            eq(matches.tournamentId, input.tournamentId),
            eq(matches.status, "scheduled"),
            sql`${matches.lockTime} > now()`,
          ),
        );
    }
    const [oldRule] = await tx
      .select()
      .from(scoringRules)
      .where(eq(scoringRules.tournamentId, input.tournamentId))
      .orderBy(desc(scoringRules.version))
      .limit(1);
    const rule = {
      exactScorePoints: input.exactScorePoints,
      winnerAndDiffPoints: input.winnerAndDiffPoints,
      winnerOnlyPoints: input.winnerOnlyPoints,
      wrongPoints: input.wrongPoints,
      groupRankingPointsPerPosition: input.groupRankingPointsPerPosition,
      rankingConfig: input.rankingConfig,
      rankingLocksAt: input.rankingLocksAt
        ? new Date(input.rankingLocksAt)
        : null,
      version: (oldRule?.version ?? 0) + 1,
    };
    if (oldRule)
      await tx
        .update(scoringRules)
        .set(rule)
        .where(eq(scoringRules.id, oldRule.id));
    else
      await tx
        .insert(scoringRules)
        .values({ tournamentId: input.tournamentId, ...rule });
    const [binding] = await tx
      .select()
      .from(tournamentProviders)
      .where(eq(tournamentProviders.tournamentId, input.tournamentId))
      .for("update");
    const categoryStatKeys: Record<string, string> = {};
    for (const [sortOrder, cat] of input.categories.entries()) {
      let id = cat.id;
      const values = {
        name: cat.name,
        type: cat.type,
        resolvesAt: cat.resolvesAt,
        duplicateStackingAllowed: cat.duplicateStackingAllowed,
        locksAt: cat.locksAt ? new Date(cat.locksAt) : null,
        sortOrder,
      };
      if (id) {
        await tx
          .update(bonusCategories)
          .set(values)
          .where(eq(bonusCategories.id, id));
        const oldCategory = before.settings.categories.find(
          (c) => c.id === id,
        )!;
        if (
          oldCategory.statKey !== cat.statKey ||
          oldCategory.type !== cat.type
        ) {
          await tx.delete(bonusStats).where(eq(bonusStats.categoryId, id));
          await tx
            .insert(systemEvents)
            .values({
              tournamentId: input.tournamentId,
              type: `bonus_snapshot:${id}`,
              payload: null,
            });
        }
        if (oldCategory.resolvesAt !== cat.resolvesAt)
          await tx
            .update(bonusPredictions)
            .set({ pointsEarned: null })
            .where(eq(bonusPredictions.categoryId, id));
        const oldSlots = before.settings.categories.find(
          (c) => c.id === id,
        )!.slots;
        const removed = oldSlots
          .filter((s) => !cat.slots.some((n) => n.id === s.id))
          .map((s) => s.id!);
        if (removed.length)
          await tx.delete(bonusSlots).where(inArray(bonusSlots.id, removed));
      } else {
        const [created] = await tx
          .insert(bonusCategories)
          .values({ tournamentId: input.tournamentId, ...values })
          .returning({ id: bonusCategories.id });
        id = created.id;
      }
      categoryStatKeys[id] = cat.statKey;
      for (const [index, slot] of cat.slots.entries()) {
        if (slot.id)
          await tx
            .update(bonusSlots)
            .set({ points: slot.points, slotIndex: index + 1 })
            .where(eq(bonusSlots.id, slot.id));
        else
          await tx
            .insert(bonusSlots)
            .values({
              categoryId: id,
              points: slot.points,
              slotIndex: index + 1,
            });
      }
    }
    const removed = before.settings.categories
      .filter((c) => !input.categories.some((n) => n.id === c.id))
      .map((c) => c.id!);
    if (removed.length)
      await tx
        .delete(bonusCategories)
        .where(inArray(bonusCategories.id, removed));
    if (binding)
      await tx
        .update(tournamentProviders)
        .set({
          bonusStatsConfig: {
            ...object(binding.bonusStatsConfig),
            categoryStatKeys,
          },
        })
        .where(eq(tournamentProviders.id, binding.id));
    else if (input.categories.some((c) => c.statKey !== "manual"))
      throw new SettingsError(
        "לטורניר הזה לא מחובר ספק נתונים. בחר בונוסים בהכרעה ידנית.",
      );
    await tx.delete(prizes).where(eq(prizes.tournamentId, input.tournamentId));
    if (input.prizes.length)
      await tx
        .insert(prizes)
        .values(
          input.prizes.map((description, i) => ({
            tournamentId: input.tournamentId,
            rank: i + 1,
            description,
          })),
        );
    await tx
      .insert(scoreAuditLogs)
      .values({
        tournamentId: input.tournamentId,
        entity: "tournament_settings",
        entityId: input.tournamentId,
        field: "settings",
        previousValue: before.settings,
        newValue: input,
        reason,
        actingUserId: userId,
      });
    // Rules, points and standings commit together, or all roll back.
    await recomputeTournamentScores(input.tournamentId, tx);
    await captureLeaderboardSnapshot(input.tournamentId, tx);
  });
}

export async function removeTournament(
  tournamentId: string,
  name: string,
  userId: string,
  database: Pick<typeof db, "transaction"> = db,
) {
  await database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"scoring:" + tournamentId},0))`,
    );
    const [t] = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .for("update");
    if (!t || name !== t.name)
      throw new SettingsError("שם הטורניר אינו תואם. לא בוצעה מחיקה.");
    // Keep a platform-level audit record after the tournament cascade.
    await tx
      .insert(systemEvents)
      .values({
        tournamentId: null,
        type: "tournament_deleted",
        payload: { tournamentId, name: t.name, actingUserId: userId },
      });
    await tx.delete(tournaments).where(eq(tournaments.id, tournamentId));
  });
}
