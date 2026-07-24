"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { adminOverrides, scoreAuditLogs } from "@/lib/db/schema/audit";
import { matches } from "@/lib/db/schema/competition";
import { scoringRules } from "@/lib/db/schema/config";
import { participants } from "@/lib/db/schema/identity";
import { matchPredictions } from "@/lib/db/schema/predictions";
import { getAdminContext } from "@/lib/auth/admin";
import { deriveWinner } from "@/lib/providers/normalize";
import { createClient } from "@/lib/supabase/server";
import {
  computeRecalculationPreview,
  type RecalculationPreview,
} from "@/lib/scoring/recalculation-preview";
import type { StandingsInput } from "@/lib/scoring/leaderboard";
import { DEFAULT_SCORING_RULES, recomputeTournamentScores } from "@/lib/scoring/recompute";
import {
  captureLeaderboardSnapshot,
  sumBonusPoints,
  sumGroupPoints,
  sumMatchPoints,
} from "@/lib/scoring/snapshots";

/**
 * Manual match-result correction + recalculation preview (ROADMAP.md Phase 7
 * task #61, UX-BLUEPRINT.md §4 screens #8-9 combined into one flow:
 * SCORING-RULES.md §9 narrows "recalculation preview" to this one remaining
 * MVP case — correcting a match result — since scoring rules themselves are
 * locked at tournament creation and never edited afterward.
 *
 * `previewMatchCorrection` is read-only (no writes) and can be called as
 * many times as the admin likes while tweaking the proposed score.
 * `applyMatchCorrection` is the only function in this file that writes,
 * and only after the admin has seen a preview.
 *
 * Writes with the service-role `db` client inside one transaction, not the
 * RLS-scoped Supabase client — same rationale as
 * app/(app)/admin/tournaments/new/actions.ts: this single action writes
 * across `matches`, `admin_overrides`, and `score_audit_logs`, which must
 * either all succeed or none do (a corrected match with no audit trail
 * would violate ARCHITECTURE.md §10's "disputes about scoring must be
 * resolvable by looking at logs, not memory"). `recomputeTournamentScores`/
 * `captureLeaderboardSnapshot` (lib/scoring/recompute.ts,
 * lib/scoring/snapshots.ts) run after the transaction commits, not inside
 * it: both are deterministic, idempotent projections over the now-committed
 * `matches` row, already used that way by the sync cron
 * (app/api/cron/sync/route.ts), and neither accepts a transaction client —
 * re-running them is always safe, unlike re-running the correction itself.
 *
 * Every action re-derives `getAdminContext` from the submitted
 * `tournamentId`, and re-checks the fetched match row actually belongs to
 * that `tournamentId`, rather than trusting the calling page's own guard —
 * defense in depth on top of RLS, the same pattern every other admin action
 * in this codebase follows.
 */

export type OverridesErrorCode =
  | "invalid_input"
  | "unauthenticated"
  | "not_admin"
  | "not_found"
  | "generic";

type AdminCheckResult =
  | { ok: true; userId: string }
  | { ok: false; code: "unauthenticated" | "not_admin" };

async function requireAdmin(tournamentId: string): Promise<AdminCheckResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "unauthenticated" };
  }
  const { isAdmin } = await getAdminContext(supabase, user.id, tournamentId);
  if (!isAdmin) {
    return { ok: false, code: "not_admin" };
  }
  return { ok: true, userId: user.id };
}

const correctionInputSchema = z.object({
  matchId: z.string().uuid(),
  tournamentId: z.string().uuid(),
  proposedHome: z.coerce.number().int().min(0).max(99),
  proposedAway: z.coerce.number().int().min(0).max(99),
});

export type PreviewMatchCorrectionState =
  | { status: "idle" }
  | {
      status: "success";
      preview: RecalculationPreview;
      proposedHome: number;
      proposedAway: number;
    }
  | { status: "error"; code: OverridesErrorCode };

/**
 * Computes (but never persists) the leaderboard impact of correcting one
 * match's result — SCORING-RULES.md §9's "admin sees the leaderboard delta
 * before committing." Only simulates this match's own points impact; see
 * lib/scoring/recalculation-preview.ts's doc comment for the deliberate
 * group-standings-ripple-effect scope gap.
 */
export async function previewMatchCorrection(
  _prevState: PreviewMatchCorrectionState,
  formData: FormData,
): Promise<PreviewMatchCorrectionState> {
  const parsed = correctionInputSchema.safeParse({
    matchId: formData.get("matchId"),
    tournamentId: formData.get("tournamentId"),
    proposedHome: formData.get("proposedHome"),
    proposedAway: formData.get("proposedAway"),
  });
  if (!parsed.success) return { status: "error", code: "invalid_input" };
  const { matchId, tournamentId, proposedHome, proposedAway } = parsed.data;

  const admin = await requireAdmin(tournamentId);
  if (!admin.ok) return { status: "error", code: admin.code };

  const [matchRow] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.id, matchId), eq(matches.tournamentId, tournamentId)))
    .limit(1);
  if (!matchRow) return { status: "error", code: "not_found" };

  const [rulesRows, predictionRows, tournamentParticipants] = await Promise.all([
    db
      .select()
      .from(scoringRules)
      .where(eq(scoringRules.tournamentId, tournamentId))
      .limit(1),
    db
      .select({
        participantId: matchPredictions.participantId,
        predictedHome: matchPredictions.predictedHome,
        predictedAway: matchPredictions.predictedAway,
        pointsEarned: matchPredictions.pointsEarned,
      })
      .from(matchPredictions)
      .where(eq(matchPredictions.matchId, matchId)),
    db
      .select({ id: participants.id, displayName: participants.displayName })
      .from(participants)
      .where(eq(participants.tournamentId, tournamentId)),
  ]);

  const rules = rulesRows[0] ?? DEFAULT_SCORING_RULES;

  const [matchPointsByParticipant, groupPointsByParticipant, bonusPointsByParticipant] =
    await Promise.all([
      sumMatchPoints(tournamentId),
      sumGroupPoints(tournamentId),
      sumBonusPoints(tournamentId),
    ]);

  const participantNames = new Map(
    tournamentParticipants.map((p) => [p.id, p.displayName]),
  );
  const currentStandings: StandingsInput[] = tournamentParticipants.map((p) => ({
    participantId: p.id,
    matchPoints: matchPointsByParticipant.get(p.id) ?? 0,
    groupRankingPoints: groupPointsByParticipant.get(p.id) ?? 0,
    bonusPoints: bonusPointsByParticipant.get(p.id) ?? 0,
  }));

  const preview = computeRecalculationPreview({
    proposedResult: { home: proposedHome, away: proposedAway },
    rules,
    predictions: predictionRows.map((row) => ({
      participantId: row.participantId,
      predicted: { home: row.predictedHome, away: row.predictedAway },
      previousPoints: row.pointsEarned ?? 0,
    })),
    currentStandings,
    participantNames,
  });

  return { status: "success", preview, proposedHome, proposedAway };
}

const applyInputSchema = correctionInputSchema.extend({
  reason: z.string().trim().min(1).max(500),
  evidenceRef: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type ApplyMatchCorrectionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; code: OverridesErrorCode };

/**
 * Persists a manual match-result correction: updates the match's canonical
 * result, writes the `admin_overrides` human-action record and the
 * `score_audit_logs` field-level before/after rows (DATABASE.md §7), then
 * re-runs the real scoring pipeline. Always marks the match `finished` /
 * `normalized` with its `warningFlag` cleared — an admin supplying a
 * regulation-time result is, by definition, resolving whatever gap or
 * contradiction the diagnostics screen (Phase 7 task #60) flagged it for.
 */
export async function applyMatchCorrection(
  _prevState: ApplyMatchCorrectionState,
  formData: FormData,
): Promise<ApplyMatchCorrectionState> {
  const parsed = applyInputSchema.safeParse({
    matchId: formData.get("matchId"),
    tournamentId: formData.get("tournamentId"),
    proposedHome: formData.get("proposedHome"),
    proposedAway: formData.get("proposedAway"),
    reason: formData.get("reason"),
    evidenceRef: formData.get("evidenceRef") || undefined,
  });
  if (!parsed.success) return { status: "error", code: "invalid_input" };
  const { matchId, tournamentId, proposedHome, proposedAway, reason, evidenceRef } =
    parsed.data;
  // Unchecked checkboxes are simply absent from FormData; a checked one
  // without an explicit `value` attribute submits "on" (MDN).
  const reversible = formData.get("reversible") === "on";

  const admin = await requireAdmin(tournamentId);
  if (!admin.ok) return { status: "error", code: admin.code };

  const [existingMatch] = await db
    .select({
      tournamentId: matches.tournamentId,
      regularResult: matches.regularResult,
      winner: matches.winner,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!existingMatch || existingMatch.tournamentId !== tournamentId) {
    return { status: "error", code: "not_found" };
  }

  const proposedResult = { home: proposedHome, away: proposedAway };
  const proposedWinner = deriveWinner(proposedResult);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(matches)
        .set({
          regularResult: proposedResult,
          winner: proposedWinner,
          status: "finished",
          normalizationStatus: "normalized",
          warningFlag: null,
        })
        .where(eq(matches.id, matchId));

      await tx.insert(adminOverrides).values({
        tournamentId,
        reason,
        evidenceRef: evidenceRef ?? null,
        enteredBy: admin.userId,
        reversible,
      });

      const auditRows: (typeof scoreAuditLogs.$inferInsert)[] = [
        {
          tournamentId,
          entity: "match",
          entityId: matchId,
          field: "regular_result",
          previousValue: existingMatch.regularResult,
          newValue: proposedResult,
          reason,
          actingUserId: admin.userId,
        },
      ];
      if (existingMatch.winner !== proposedWinner) {
        auditRows.push({
          tournamentId,
          entity: "match",
          entityId: matchId,
          field: "winner",
          previousValue: existingMatch.winner,
          newValue: proposedWinner,
          reason,
          actingUserId: admin.userId,
        });
      }
      await tx.insert(scoreAuditLogs).values(auditRows);
    });
  } catch {
    return { status: "error", code: "generic" };
  }

  await recomputeTournamentScores(tournamentId);
  await captureLeaderboardSnapshot(tournamentId);

  revalidatePath("/admin/diagnostics");
  revalidatePath(`/admin/diagnostics/${matchId}`);
  revalidatePath(`/admin/overrides/${matchId}`);
  revalidatePath("/leaderboard");

  return { status: "success" };
}
