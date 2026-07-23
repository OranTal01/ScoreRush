"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";

/**
 * Group ranking prediction submit/edit — screen 11 (UX-BLUEPRINT.md §3).
 * Orchestration only (ARCHITECTURE.md §2): the real backstop is the
 * `group_predictions_write_own_before_finalized` RLS policy
 * (lib/db/migrations/0001_rls_policies.sql), which keys off
 * `group_predictions.finalized` — set once SCORING-RULES.md §5's "entire
 * group stage complete" condition is met (lib/scoring/group-standings.ts
 * `isGroupStageComplete`), by the recompute pipeline (ROADMAP.md Phase 5).
 * Unlike match predictions there's no pre-stage lock time here: a
 * participant can edit their predicted order any time before finalization,
 * exactly as the RLS policy allows — this action doesn't invent a stricter
 * rule the database wouldn't itself enforce.
 */

const inputSchema = z.object({
  group: z.string().trim().min(1),
  predictedOrder: z.array(z.string().uuid()).min(2),
});

export type GroupPredictionErrorCode =
  | "invalid_input"
  | "unauthenticated"
  | "not_a_member"
  | "finalized"
  | "generic";

export type SubmitGroupPredictionState =
  | { status: "idle" }
  | { status: "success"; group: string; predictedOrder: string[] }
  | { status: "error"; code: GroupPredictionErrorCode };

export async function submitGroupPrediction(
  _prevState: SubmitGroupPredictionState,
  formData: FormData,
): Promise<SubmitGroupPredictionState> {
  let predictedOrderRaw: unknown = null;
  try {
    const raw = formData.get("predictedOrder");
    predictedOrderRaw = typeof raw === "string" ? JSON.parse(raw) : null;
  } catch {
    predictedOrderRaw = null;
  }

  const parsed = inputSchema.safeParse({
    group: formData.get("group"),
    predictedOrder: predictedOrderRaw,
  });
  if (!parsed.success) {
    return { status: "error", code: "invalid_input" };
  }
  const { group, predictedOrder } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", code: "unauthenticated" };
  }

  const current = await getCurrentParticipant(supabase, user.id);
  if (!current) {
    return { status: "error", code: "not_a_member" };
  }
  const { participantId, tournamentId } = current;

  // Defense in depth beyond RLS (which only checks ownership + finalized,
  // not group membership): the submitted order must be exactly the set of
  // teams actually in this group, no more, no less, no duplicates.
  const { data: groupTeams } = await supabase
    .from("teams")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("group", group);

  const validIds = new Set((groupTeams ?? []).map((t) => t.id));
  const noDuplicates = new Set(predictedOrder).size === predictedOrder.length;
  const isExactSet =
    validIds.size > 0 &&
    validIds.size === predictedOrder.length &&
    predictedOrder.every((id) => validIds.has(id));

  if (!noDuplicates || !isExactSet) {
    return { status: "error", code: "invalid_input" };
  }

  const { error: upsertError } = await supabase.from("group_predictions").upsert(
    {
      tournament_id: tournamentId,
      participant_id: participantId,
      group,
      predicted_order: predictedOrder,
    },
    { onConflict: "tournament_id,participant_id,group" },
  );

  if (upsertError) {
    return { status: "error", code: classifyWriteError(upsertError.message) };
  }

  revalidatePath("/groups");
  return { status: "success", group, predictedOrder };
}

function classifyWriteError(message: string): GroupPredictionErrorCode {
  if (message.toLowerCase().includes("row-level security")) return "finalized";
  return "generic";
}
