"use server";

import { resolveFootballChoice } from "@/lib/content/football-names";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBonusOptions } from "@/lib/tournaments/bonus-options";
import { createClient } from "@/lib/supabase/server";
import { isPast } from "@/lib/time";

/**
 * Bonus category pick submit/edit — screen 10 (UX-BLUEPRINT.md §3).
 * Orchestration only (ARCHITECTURE.md §2): the real backstop is the
 * `bonus_predictions_write_own_before_lock` RLS policy (lib/db/migrations/
 * 0001_rls_policies.sql), keyed off `bonus_categories.locks_at` via
 * `is_bonus_category_locked()`. A `bonus_predictions` row is keyed by
 * `(slot_id, participant_id)` (DATABASE.md §2) — one submit writes every
 * slot pick in the category at once, so a single save button covers the
 * whole category.
 */

const inputSchema = z.object({
  categoryId: z.string().uuid(),
  picks: z
    .array(
      z.object({
        slotId: z.string().uuid(),
        pickLabel: z.string().trim().min(1).max(200),
        pickRefId: z.string().trim().min(1).max(100).optional(),
      }),
    )
    .min(1),
});

export type BonusPredictionErrorCode =
  "invalid_input" | "unauthenticated" | "not_a_member" | "locked" | "generic";

export type SubmitBonusPredictionState =
  | { status: "idle" }
  | { status: "success"; categoryId: string }
  | { status: "error"; code: BonusPredictionErrorCode };

export async function submitBonusPrediction(
  _prevState: SubmitBonusPredictionState,
  formData: FormData,
): Promise<SubmitBonusPredictionState> {
  try {
    return await saveBonus(formData);
  } catch (error) {
    console.error(
      "Bonus save failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return { status: "error", code: "generic" };
  }
}

async function saveBonus(
  formData: FormData,
): Promise<SubmitBonusPredictionState> {
  let picksRaw: unknown = null;
  try {
    const raw = formData.get("picks");
    picksRaw = typeof raw === "string" ? JSON.parse(raw) : null;
  } catch {
    picksRaw = null;
  }

  const parsed = inputSchema.safeParse({
    categoryId: formData.get("categoryId"),
    picks: picksRaw,
  });
  if (!parsed.success) {
    return { status: "error", code: "invalid_input" };
  }
  const { categoryId, picks } = parsed.data;

  const supabase = await createClient({ signal: AbortSignal.timeout(20000) });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", code: "unauthenticated" };
  }

  // `bonus_categories_select_members` RLS already scopes this to categories
  // in tournaments the caller belongs to — an id for a category in a
  // tournament the caller isn't a member of comes back as "no row".
  const { data: category } = await supabase
    .from("bonus_categories")
    .select(
      "id, tournament_id, type, locks_at, duplicate_stacking_allowed, tournaments(onboarding_open)",
    )
    .eq("id", categoryId)
    .maybeSingle();

  if (!category) {
    return { status: "error", code: "invalid_input" };
  }
  const onboarding =
    (category.tournaments as { onboarding_open?: boolean } | null)
      ?.onboarding_open === true;
  if (!onboarding && category.locks_at !== null && isPast(category.locks_at)) {
    return { status: "error", code: "locked" };
  }

  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("tournament_id", category.tournament_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) {
    return { status: "error", code: "not_a_member" };
  }

  // Defense in depth beyond RLS (which only checks ownership + lock, not
  // slot membership or the category's own duplicate-stacking config):
  // every submitted slot must actually belong to this category, and if
  // duplicate picks aren't allowed for it (SCORING-RULES.md §6), no two
  // slots in this submission may carry the same pick.
  const { data: categorySlots } = await supabase
    .from("bonus_slots")
    .select("id")
    .eq("category_id", categoryId);

  const validSlotIds = new Set((categorySlots ?? []).map((s) => s.id));
  const allSlotsValid = picks.every((p) => validSlotIds.has(p.slotId));
  if (new Set(picks.map((pick) => pick.slotId)).size !== picks.length)
    return { status: "error", code: "invalid_input" };
  let choices: Awaited<ReturnType<typeof getBonusOptions>> = [];
  try {
    choices = await getBonusOptions(
      supabase,
      category.tournament_id,
      category.type,
    );
  } catch {
    return { status: "error", code: "generic" };
  }
  for (const pick of picks) {
    const choice = pick.pickRefId
      ? choices.find((option) => option.refId === pick.pickRefId)
      : resolveFootballChoice(choices, pick.pickLabel);
    if (pick.pickRefId && !choice)
      return { status: "error", code: "invalid_input" };
    if (category.type === "team" && choices.length && !choice)
      return { status: "error", code: "invalid_input" };
    if (choice) {
      pick.pickRefId = choice.refId;
      pick.pickLabel = choice.label;
    }
  }
  const normalizedLabels = picks.map(
    (p) => p.pickRefId ?? p.pickLabel.toLowerCase(),
  );
  const duplicatesOk =
    category.duplicate_stacking_allowed ||
    new Set(normalizedLabels).size === normalizedLabels.length;

  if (!allSlotsValid || !duplicatesOk) {
    return { status: "error", code: "invalid_input" };
  }

  const { error: upsertError } = await supabase
    .from("bonus_predictions")
    .upsert(
      picks.map((p) => ({
        category_id: categoryId,
        slot_id: p.slotId,
        participant_id: participant.id,
        pick_label: p.pickLabel,
        ...(p.pickRefId ? { pick_ref_id: p.pickRefId } : {}),
      })),
      { onConflict: "slot_id,participant_id" },
    );

  if (upsertError) {
    return { status: "error", code: classifyWriteError(upsertError.message) };
  }

  revalidatePath("/bonuses");
  return { status: "success", categoryId };
}

function classifyWriteError(message: string): BonusPredictionErrorCode {
  if (message.toLowerCase().includes("row-level security")) return "locked";
  return "generic";
}
