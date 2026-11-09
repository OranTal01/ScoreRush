"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  allowsRetrospectiveEntry,
  type OnboardingSettings,
} from "@/lib/tournaments/onboarding";
import { isPast } from "@/lib/time";
import { readPredictionContinuation } from "@/lib/predictions/read-continuation";
import type { PredictionContinuation } from "@/lib/predictions/continuation";

/**
 * Match prediction submit/edit — screen 6 (UX-BLUEPRINT.md §3) "save states
 * (idle/pressed/loading/success/error)". Orchestration only (ARCHITECTURE.md
 * §2): the real lock-time backstop is the `match_predictions_write_own_before_lock`
 * RLS policy (lib/db/migrations/0001_rls_policies.sql), which keys off
 * `matches.lock_time` via the `is_match_locked()` helper. This action adds a
 * friendly pre-check + typed error surface on top of that policy — the
 * pre-check is a UX nicety, never the only thing standing between a request
 * and the write.
 */

const inputSchema = z.object({
  matchId: z.string().uuid(),
  predictedHome: z
    .string()
    .regex(/^\d{1,2}$/)
    .transform(Number),
  predictedAway: z
    .string()
    .regex(/^\d{1,2}$/)
    .transform(Number),
});

export type PredictionErrorCode =
  | "invalid_input"
  | "unauthenticated"
  | "not_found"
  | "not_a_member"
  | "locked"
  | "generic";

export type SubmitMatchPredictionState =
  | { status: "idle" }
  | {
      status: "success";
      predictedHome: number;
      predictedAway: number;
      continuation?: PredictionContinuation;
    }
  | { status: "error"; code: PredictionErrorCode };

export async function submitMatchPrediction(
  _prevState: SubmitMatchPredictionState,
  formData: FormData,
): Promise<SubmitMatchPredictionState> {
  const parsed = inputSchema.safeParse({
    matchId: formData.get("matchId"),
    predictedHome: formData.get("predictedHome"),
    predictedAway: formData.get("predictedAway"),
  });
  if (!parsed.success) {
    return { status: "error", code: "invalid_input" };
  }
  const { matchId, predictedHome, predictedAway } = parsed.data;

  const supabase = await createClient({ signal: AbortSignal.timeout(15000) });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", code: "unauthenticated" };
  }

  // `matches_select_members` RLS already scopes this to matches in
  // tournaments the caller belongs to — a bad id and a real match in a
  // tournament the caller isn't a member of both come back as "no row",
  // which is the right response either way (never leaks existence of a
  // match the caller can't see).
  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, tournament_id, lock_time, matchday, stage, status, tournaments(onboarding_open, onboarding_matchday, onboarding_closes_at)",
    )
    .eq("id", matchId)
    .maybeSingle<{
      id: string;
      tournament_id: string;
      lock_time: string;
      matchday: number | null;
      stage: string;
      status: string;
      tournaments: OnboardingSettings | null;
    }>();

  if (!match) {
    return { status: "error", code: "not_found" };
  }
  const settings = match.tournaments as OnboardingSettings | null;
  if (
    (match.status !== "scheduled" || isPast(match.lock_time)) &&
    !allowsRetrospectiveEntry(settings, match)
  ) {
    return { status: "error", code: "locked" };
  }

  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("tournament_id", match.tournament_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) {
    return { status: "error", code: "not_a_member" };
  }

  // A retrospective window is a last chance to fill a missing/default pick.
  // Once a real pick exists, keep it immutable so known results cannot be used
  // to rewrite it.
  if (allowsRetrospectiveEntry(settings, match) && isPast(match.lock_time)) {
    const { data: existing } = await supabase
      .from("match_predictions")
      .select("is_default")
      .eq("match_id", matchId)
      .eq("participant_id", participant.id)
      .maybeSingle<{ is_default: boolean }>();
    if (existing && !existing.is_default)
      return { status: "error", code: "locked" };
  }

  // Insert first, fall back to update on a unique-violation (an existing
  // prediction for this match/participant) — this keeps `submitted_at`
  // untouched on edits and only ever sets `edited_at` on a real edit, while
  // still being race-safe against a double-submit racing two inserts.
  const { error: insertError } = await supabase
    .from("match_predictions")
    .insert({
      match_id: matchId,
      participant_id: participant.id,
      predicted_home: predictedHome,
      predicted_away: predictedAway,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: updated, error: updateError } = await supabase
        .from("match_predictions")
        .update({
          predicted_home: predictedHome,
          predicted_away: predictedAway,
          edited_at: new Date().toISOString(),
        })
        .eq("match_id", matchId)
        .eq("participant_id", participant.id)
        .select("match_id");

      if (updateError) {
        return {
          status: "error",
          code: classifyWriteError(updateError.message),
        };
      }
      if (!updated?.length) return { status: "error", code: "locked" };
    } else {
      return { status: "error", code: classifyWriteError(insertError.message) };
    }
  }

  // Retrospective picks target matches with known results. Re-score immediately
  // so the participant sees the new points and leaderboard without waiting for
  // the next scheduled sync.
  if (allowsRetrospectiveEntry(settings, match) && isPast(match.lock_time)) {
    try {
      const [{ recomputeTournamentScores }, { captureLeaderboardSnapshot }] =
        await Promise.all([
          import("@/lib/scoring/recompute"),
          import("@/lib/scoring/snapshots"),
        ]);
      await recomputeTournamentScores(match.tournament_id);
      await captureLeaderboardSnapshot(match.tournament_id);
    } catch {
      // The pick is already saved; the next sync remains a safe retry path.
      console.error("Retrospective score refresh failed");
    }
  }

  revalidatePath(`/predictions/${matchId}`);
  revalidatePath("/predictions");
  revalidatePath("/leaderboard");
  revalidatePath("/");
  if (formData.get("advance") === "1") {
    // Saving has already succeeded. A failed follow-up read must not turn it
    // into an apparent failed save or incorrectly announce round completion.
    try {
      const continuation = await readPredictionContinuation(
        supabase,
        match,
        participant.id,
      );
      return { status: "success", predictedHome, predictedAway, continuation };
    } catch {
      /* The caller keeps the confirmed save and offers the match list. */
    }
  }
  return { status: "success", predictedHome, predictedAway };
}

function classifyWriteError(message: string): PredictionErrorCode {
  if (message.toLowerCase().includes("row-level security")) return "locked";
  return "generic";
}
