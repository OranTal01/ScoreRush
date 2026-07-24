/**
 * DB-facing recompute/write pipeline (ROADMAP.md Phase 5 task #50):
 * reads a tournament's current canonical state (matches, teams,
 * bonus_stats) and every participant's predictions, runs them through the
 * pure `lib/scoring/*` functions, and writes `points_earned`/`outcome`/
 * `finalized` back onto `match_predictions`/`group_predictions`/
 * `bonus_predictions`. ARCHITECTURE.md §2: the scoring math itself stays in
 * pure, DB-free functions (match-scoring.ts, group-scoring.ts,
 * bonus-scoring.ts, group-standings.ts) — this module is only the
 * orchestration + persistence around them.
 *
 * Uses the service-role Drizzle client (`lib/db/client.ts`), not the
 * RLS-scoped Supabase client, since it writes every participant's rows in
 * one pass, not just one caller's own — the same trusted-backend-job
 * posture as `lib/sync/upsert-matches.ts` and `lib/sync/run-sync.ts`. RLS's
 * "own row" write policies exist for participant-facing requests
 * (app/(app)/*\/actions.ts), not this job.
 */
import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { matches } from "@/lib/db/schema/competition";
import { bonusCategories, bonusSlots, scoringRules } from "@/lib/db/schema/config";
import { tournaments } from "@/lib/db/schema/identity";
import {
  bonusPredictions,
  bonusStats,
  groupPredictions,
  matchPredictions,
} from "@/lib/db/schema/predictions";
import {
  isBonusCategoryScorable,
  scoreBonusCategory,
  type BonusPick,
  type BonusStatWinner,
} from "./bonus-scoring";
import {
  calculateGroupStandings,
  isGroupStageComplete,
  standingsByGroup,
  type StandingsMatch,
} from "./group-standings";
import { scoreGroupRanking } from "./group-scoring";
import { scoreMatch, type MatchScoringRules } from "./match-scoring";

type ScoringRulesValues = MatchScoringRules & {
  groupRankingPointsPerPosition: number;
};

/**
 * Mirrors the `scoring_rules` table's own column defaults — SCORING-RULES.md
 * §1 documents these as "the out-of-the-box default... for a new
 * tournament." Used whenever a tournament has no `scoring_rules` row yet —
 * the tournament-creation flow (Phase 7 task #58) always inserts one, but a
 * pilot tournament seeded directly in the DB before that flow existed may
 * not have one.
 *
 * Exported for reuse by the recalculation-preview orchestration (Phase 7
 * task #61), so both the real recompute and the preview agree on the same
 * fallback.
 */
export const DEFAULT_SCORING_RULES: ScoringRulesValues = {
  exactScorePoints: 9,
  winnerAndDiffPoints: 6,
  winnerOnlyPoints: 3,
  wrongPoints: 0,
  groupRankingPointsPerPosition: 3,
};

type TournamentMatch = typeof matches.$inferSelect;

export interface RecomputeResult {
  tournamentId: string;
  matchPredictionsScored: number;
  groupPredictionsScored: number;
  groupStageFinalized: boolean;
  bonusPredictionsScored: number;
}

export async function recomputeTournamentScores(
  tournamentId: string,
): Promise<RecomputeResult> {
  const [tournament] = await db
    .select({ status: tournaments.status })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) {
    throw new Error(`tournament ${tournamentId} not found`);
  }

  const [rulesRow] = await db
    .select()
    .from(scoringRules)
    .where(eq(scoringRules.tournamentId, tournamentId))
    .limit(1);
  const rules: ScoringRulesValues = rulesRow ?? DEFAULT_SCORING_RULES;

  const tournamentMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));

  const matchPredictionsScored = await recomputeMatchPredictions(
    tournamentMatches,
    rules,
  );
  const groupResult = await recomputeGroupPredictions(
    tournamentId,
    tournamentMatches,
    rules.groupRankingPointsPerPosition,
  );
  const bonusPredictionsScored = await recomputeBonusPredictions(
    tournamentId,
    tournament.status,
  );

  return {
    tournamentId,
    matchPredictionsScored,
    groupPredictionsScored: groupResult.scored,
    groupStageFinalized: groupResult.finalized,
    bonusPredictionsScored,
  };
}

/** Scores every match_predictions row against its (now-finished) match's
 * regularResult (SCORING-RULES.md §2-3) and writes points_earned/outcome
 * back. Matches that aren't finished yet, or predictions with no matching
 * finished match, are left untouched. */
async function recomputeMatchPredictions(
  tournamentMatches: TournamentMatch[],
  rules: MatchScoringRules,
): Promise<number> {
  const finishedMatches = tournamentMatches.filter(
    (m) => m.status === "finished" && m.regularResult !== null,
  );
  if (finishedMatches.length === 0) return 0;

  const matchById = new Map(finishedMatches.map((m) => [m.id, m]));
  const predictions = await db
    .select()
    .from(matchPredictions)
    .where(
      inArray(
        matchPredictions.matchId,
        finishedMatches.map((m) => m.id),
      ),
    );

  let scored = 0;
  for (const prediction of predictions) {
    const match = matchById.get(prediction.matchId);
    if (!match) continue;

    const result = scoreMatch(
      match,
      { home: prediction.predictedHome, away: prediction.predictedAway },
      rules,
    );
    if (result === null) continue;

    await db
      .update(matchPredictions)
      .set({ pointsEarned: result.points, outcome: result.outcome })
      .where(eq(matchPredictions.id, prediction.id));
    scored += 1;
  }
  return scored;
}

/** Scores every group_predictions row against the actual final standings and
 * flips `finalized`, but only once `isGroupStageComplete` — SCORING-RULES.md
 * §5's "entire group stage complete" gate, the same check
 * app/(app)/groups/page.tsx reads back via the `finalized` column rather
 * than recomputing itself (single source of truth). A tournament with no
 * group-stage matches at all (knockout-only) never finalizes, by design. */
async function recomputeGroupPredictions(
  tournamentId: string,
  tournamentMatches: TournamentMatch[],
  pointsPerPosition: number,
): Promise<{ scored: number; finalized: boolean }> {
  const standingsInput: StandingsMatch[] = tournamentMatches.map((m) => ({
    status: m.status,
    group: m.group,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    regularResult: m.regularResult,
  }));

  if (!isGroupStageComplete(standingsInput)) {
    return { scored: 0, finalized: false };
  }

  const actualByGroup = standingsByGroup(calculateGroupStandings(standingsInput));

  const predictions = await db
    .select()
    .from(groupPredictions)
    .where(eq(groupPredictions.tournamentId, tournamentId));

  let scored = 0;
  for (const prediction of predictions) {
    const actualOrder = actualByGroup.get(prediction.group) ?? [];
    const points = scoreGroupRanking(
      actualOrder,
      prediction.predictedOrder,
      pointsPerPosition,
    );
    await db
      .update(groupPredictions)
      .set({ pointsEarned: points, finalized: true })
      .where(eq(groupPredictions.id, prediction.id));
    scored += 1;
  }
  return { scored, finalized: true };
}

/** Scores every bonus_predictions row for every category whose bonus_stats
 * snapshot is scorable yet (SCORING-RULES.md §6-7: ongoing categories score
 * against whatever partial snapshot exists; terminal categories only once
 * the tournament is finished). Each slot's pick is scored independently —
 * duplicate picks across slots stack automatically (§6) since
 * `scoreBonusCategory` is called per-pick here, not once per category. A
 * category with no resolved bonus_stats snapshot yet is left untouched. */
async function recomputeBonusPredictions(
  tournamentId: string,
  tournamentStatus: "upcoming" | "active" | "finished",
): Promise<number> {
  const categories = await db
    .select()
    .from(bonusCategories)
    .where(eq(bonusCategories.tournamentId, tournamentId));

  let scored = 0;
  for (const category of categories) {
    if (
      !isBonusCategoryScorable(
        { resolvesAt: category.resolvesAt },
        tournamentStatus,
      )
    ) {
      continue;
    }

    const stats = await db
      .select()
      .from(bonusStats)
      .where(eq(bonusStats.categoryId, category.id));
    if (stats.length === 0) continue;

    const winners: BonusStatWinner[] = stats.map((s) => ({
      refId: s.refId,
      label: s.label,
      rank: s.rank,
    }));

    const slots = await db
      .select()
      .from(bonusSlots)
      .where(eq(bonusSlots.categoryId, category.id));
    const pointsBySlot = new Map(slots.map((s) => [s.id, s.points]));

    const picks = await db
      .select()
      .from(bonusPredictions)
      .where(eq(bonusPredictions.categoryId, category.id));

    for (const pick of picks) {
      const slotPoints = pointsBySlot.get(pick.slotId);
      if (slotPoints === undefined) continue;

      const bonusPick: BonusPick = {
        slotId: pick.slotId,
        points: slotPoints,
        pickRefId: pick.pickRefId,
        pickLabel: pick.pickLabel,
      };
      const points = scoreBonusCategory([bonusPick], winners);

      await db
        .update(bonusPredictions)
        .set({ pointsEarned: points })
        .where(eq(bonusPredictions.id, pick.id));
      scored += 1;
    }
  }
  return scored;
}
