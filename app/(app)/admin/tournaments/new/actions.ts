"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { systemEvents } from "@/lib/db/schema/audit";
import {
  bonusCategories,
  bonusSlots,
  prizes,
  scoringRules,
  tournamentProviders,
} from "@/lib/db/schema/config";
import { participants, tournaments } from "@/lib/db/schema/identity";
import { isPlatformAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Tournament creation — the one place scoring/bonus/prize configuration is
 * ever set (DECISIONS.md "Rule editability mid-tournament": locked at
 * creation, never edited afterward for MVP; SCORING-RULES.md §9's
 * recalculation-preview machinery is only for a match-result correction,
 * not a rules change). Platform-owner-only (DECISIONS.md "Tournament
 * creation — RESOLVED: platform owner only").
 *
 * Writes with the service-role `db` client inside one transaction, not the
 * RLS-scoped Supabase client: this single request inserts across six
 * tables (tournament, scoring_rules, bonus_categories+slots, prizes,
 * tournament_providers, and the creator's own tournament_admin participant
 * row) that must either all succeed or none do — a partially-created
 * tournament with no scoring_rules row would silently fall back to
 * DEFAULT_SCORING_RULES (lib/scoring/recompute.ts), which is exactly the
 * kind of implicit-default outcome ARCHITECTURE.md wants avoided. The
 * `participants` insert in particular assigns `role: "tournament_admin"`
 * directly, which a self-service RLS insert policy would never allow (self
 * writes default to "participant" — DATABASE.md §5) — legitimate here only
 * because the app-layer `isPlatformAdmin` check below already gated the
 * whole action, mirroring the precedent in lib/sync/upsert-matches.ts for
 * other authoritative, server-only write paths.
 */

const bonusSlotInputSchema = z.object({
  points: z.coerce.number().int().min(0).max(999),
});

const bonusCategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.string().trim().min(1).max(50),
  resolvesAt: z.enum(["ongoing", "tournament_end"]),
  duplicateStackingAllowed: z.boolean(),
  slots: z.array(bonusSlotInputSchema).min(1).max(20),
});

const prizeInputSchema = z.object({
  description: z.string().trim().min(1).max(200),
});

const inputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    competition: z.string().trim().min(1).max(60),
    dataSource: z.enum(["football_data_org", "manual"]),
    competitionCode: z
      .string()
      .trim()
      .max(20)
      .optional()
      .transform((v) => (v ? v : undefined)),
    season: z.coerce.number().int().min(1900).max(2200).optional(),
    exactScorePoints: z.coerce.number().int().min(0).max(999),
    winnerAndDiffPoints: z.coerce.number().int().min(0).max(999),
    winnerOnlyPoints: z.coerce.number().int().min(0).max(999),
    wrongPoints: z.coerce.number().int().min(0).max(999),
    groupRankingPointsPerPosition: z.coerce.number().int().min(0).max(999),
    bonusCategories: z.array(bonusCategoryInputSchema).max(20),
    prizes: z.array(prizeInputSchema).max(50),
  })
  .refine(
    (data) =>
      data.dataSource !== "football_data_org" ||
      (data.competitionCode !== undefined && data.competitionCode.length > 0),
    {
      message: "competitionCode is required when dataSource is football_data_org",
      path: ["competitionCode"],
    },
  );

export type CreateTournamentErrorCode =
  | "invalid_input"
  | "unauthenticated"
  | "not_platform_admin"
  | "generic";

export type CreateTournamentState =
  | { status: "idle" }
  | { status: "success"; tournamentId: string }
  | { status: "error"; code: CreateTournamentErrorCode };

export async function createTournament(
  _prevState: CreateTournamentState,
  formData: FormData,
): Promise<CreateTournamentState> {
  let bonusCategoriesRaw: unknown = [];
  let prizesRaw: unknown = [];
  try {
    const bc = formData.get("bonusCategories");
    bonusCategoriesRaw = typeof bc === "string" ? JSON.parse(bc) : [];
    const pz = formData.get("prizes");
    prizesRaw = typeof pz === "string" ? JSON.parse(pz) : [];
  } catch {
    return { status: "error", code: "invalid_input" };
  }

  const parsed = inputSchema.safeParse({
    name: formData.get("name"),
    competition: formData.get("competition"),
    dataSource: formData.get("dataSource"),
    competitionCode: formData.get("competitionCode") || undefined,
    season: formData.get("season") || undefined,
    exactScorePoints: formData.get("exactScorePoints"),
    winnerAndDiffPoints: formData.get("winnerAndDiffPoints"),
    winnerOnlyPoints: formData.get("winnerOnlyPoints"),
    wrongPoints: formData.get("wrongPoints"),
    groupRankingPointsPerPosition: formData.get(
      "groupRankingPointsPerPosition",
    ),
    bonusCategories: bonusCategoriesRaw,
    prizes: prizesRaw,
  });
  if (!parsed.success) {
    return { status: "error", code: "invalid_input" };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", code: "unauthenticated" };
  }

  if (!(await isPlatformAdmin(supabase, user.id))) {
    return { status: "error", code: "not_platform_admin" };
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string }>();
  const displayName = userRow?.display_name ?? user.email ?? "Admin";

  const matchDataConfig =
    data.dataSource === "football_data_org"
      ? { competitionCode: data.competitionCode, ...(data.season ? { season: data.season } : {}) }
      : { entries: [] };
  const bonusStatsConfig =
    data.dataSource === "football_data_org"
      ? { competitionCode: data.competitionCode, ...(data.season ? { season: data.season } : {}) }
      : { stats: [] };

  try {
    const tournamentId = await db.transaction(async (tx) => {
      const [tournament] = await tx
        .insert(tournaments)
        .values({
          name: data.name,
          competition: data.competition,
          createdBy: user.id,
        })
        .returning({ id: tournaments.id });

      await tx.insert(scoringRules).values({
        tournamentId: tournament.id,
        exactScorePoints: data.exactScorePoints,
        winnerAndDiffPoints: data.winnerAndDiffPoints,
        winnerOnlyPoints: data.winnerOnlyPoints,
        wrongPoints: data.wrongPoints,
        groupRankingPointsPerPosition: data.groupRankingPointsPerPosition,
      });

      for (const [index, prize] of data.prizes.entries()) {
        await tx.insert(prizes).values({
          tournamentId: tournament.id,
          rank: index + 1,
          description: prize.description,
        });
      }

      for (const category of data.bonusCategories) {
        const [createdCategory] = await tx
          .insert(bonusCategories)
          .values({
            tournamentId: tournament.id,
            name: category.name,
            type: category.type,
            resolvesAt: category.resolvesAt,
            duplicateStackingAllowed: category.duplicateStackingAllowed,
          })
          .returning({ id: bonusCategories.id });

        for (const [slotIndex, slot] of category.slots.entries()) {
          await tx.insert(bonusSlots).values({
            categoryId: createdCategory.id,
            slotIndex: slotIndex + 1,
            points: slot.points,
          });
        }
      }

      await tx.insert(tournamentProviders).values({
        tournamentId: tournament.id,
        matchDataProvider: data.dataSource,
        matchDataConfig,
        bonusStatsProvider: data.dataSource,
        bonusStatsConfig,
      });

      await tx.insert(participants).values({
        tournamentId: tournament.id,
        userId: user.id,
        role: "tournament_admin",
        displayName,
      });

      await tx.insert(systemEvents).values({
        tournamentId: tournament.id,
        type: "tournament_created",
        payload: {
          name: data.name,
          competition: data.competition,
          createdBy: user.id,
        },
      });

      return tournament.id;
    });

    revalidatePath("/admin");
    revalidatePath("/");
    return { status: "success", tournamentId };
  } catch (err) {
    console.error("createTournament failed", err);
    return { status: "error", code: "generic" };
  }
}
