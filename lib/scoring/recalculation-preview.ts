/**
 * Pure recalculation-preview computation for a proposed match-result
 * correction (SCORING-RULES.md §9: since scoring rules are locked at
 * tournament creation — DECISIONS.md "Rule editability mid-tournament" —
 * the one legitimate MVP use of "recalculation preview" left is correcting
 * a match result, e.g. a provider correction or a manual override, never a
 * rules change). Reuses the existing pure `scoreMatchPrediction`
 * (match-scoring.ts) and `computeStandings` (leaderboard.ts) rather than
 * re-implementing scoring/ranking math — this module is only the delta
 * computation between "current" and "if this correction were applied."
 *
 * Deliberately scoped to *match-points* impact only — does NOT simulate
 * downstream group-standings ripple effects, even though the real
 * apply-time recompute (recompute.ts's `recomputeTournamentScores`) does
 * handle group predictions correctly once the correction is actually
 * applied. Simulating "what every group's predicted-standings score would
 * have been under the corrected result" is a meaningfully harder
 * combinatorial problem (one match feeds `calculateGroupStandings` for its
 * whole group) that would add significant risk for a screen whose only job
 * is giving an admin reasonable confidence before clicking "apply" — the
 * real recompute remains the source of truth once applied. Bonus points are
 * unaffected by construction: bonus stats come from an independent
 * provider/category system (ARCHITECTURE.md §6), never from a match's own
 * result. This gap is disclosed to the admin in the UI copy
 * (lib/content/he.ts `overrides.previewScopeNote`), not hidden.
 *
 * DB-free by design (ARCHITECTURE.md §2) — the caller (a "server-only"
 * orchestration module) is responsible for loading the affected
 * match_predictions rows and current per-participant standings inputs.
 */
import type { MatchScore } from "@/lib/db/schema/competition";
import {
  scoreMatchPrediction,
  type MatchPredictionScore,
  type MatchScoringRules,
} from "./match-scoring";
import { computeStandings, type StandingsInput } from "./leaderboard";

export interface PredictionRescoreInput {
  participantId: string;
  predicted: MatchScore;
  /** The prediction's current persisted `points_earned` (0 if never scored, e.g. the match wasn't finished before) — the baseline the delta is measured against. */
  previousPoints: number;
}

export interface PredictionRescoreResult extends MatchPredictionScore {
  participantId: string;
  displayName: string;
  previousPoints: number;
  /** New points minus previous points — negative when the correction costs a participant points. */
  pointsDelta: number;
}

export interface StandingsRankDelta {
  participantId: string;
  displayName: string;
  previousRank: number;
  proposedRank: number;
  previousTotalPoints: number;
  proposedTotalPoints: number;
}

export interface RecalculationPreviewInput {
  proposedResult: MatchScore;
  rules: MatchScoringRules;
  /** Every participant who predicted this match. */
  predictions: readonly PredictionRescoreInput[];
  /** Every tournament participant's current match/group/bonus point totals — the same shape `captureLeaderboardSnapshot` (snapshots.ts) builds, so "current" here always agrees with the leaderboard the admin sees elsewhere. */
  currentStandings: readonly StandingsInput[];
  participantNames: ReadonlyMap<string, string>;
}

export interface RecalculationPreview {
  predictionChanges: PredictionRescoreResult[];
  /** Only participants whose rank or total actually changes — most participants in a tournament are unaffected by any one match's correction. */
  rankChanges: StandingsRankDelta[];
}

function nameFor(names: ReadonlyMap<string, string>, participantId: string): string {
  return names.get(participantId) ?? participantId;
}

export function computeRecalculationPreview(
  input: RecalculationPreviewInput,
): RecalculationPreview {
  const predictionChanges: PredictionRescoreResult[] = input.predictions.map(
    (prediction) => {
      const scored = scoreMatchPrediction(
        input.proposedResult,
        prediction.predicted,
        input.rules,
      );
      return {
        ...scored,
        participantId: prediction.participantId,
        displayName: nameFor(input.participantNames, prediction.participantId),
        previousPoints: prediction.previousPoints,
        pointsDelta: scored.points - prediction.previousPoints,
      };
    },
  );

  const deltaByParticipant = new Map(
    predictionChanges.map((change) => [change.participantId, change.pointsDelta]),
  );

  const previousStandings = computeStandings(input.currentStandings);
  const proposedStandingsInput: StandingsInput[] = input.currentStandings.map(
    (entry) => ({
      ...entry,
      matchPoints: entry.matchPoints + (deltaByParticipant.get(entry.participantId) ?? 0),
    }),
  );
  const proposedStandings = computeStandings(proposedStandingsInput);

  const previousByParticipant = new Map(
    previousStandings.map((entry) => [entry.participantId, entry]),
  );

  const rankChanges: StandingsRankDelta[] = [];
  for (const proposed of proposedStandings) {
    const previous = previousByParticipant.get(proposed.participantId);
    if (!previous) continue;
    if (
      previous.rank !== proposed.rank ||
      previous.totalPoints !== proposed.totalPoints
    ) {
      rankChanges.push({
        participantId: proposed.participantId,
        displayName: nameFor(input.participantNames, proposed.participantId),
        previousRank: previous.rank,
        proposedRank: proposed.rank,
        previousTotalPoints: previous.totalPoints,
        proposedTotalPoints: proposed.totalPoints,
      });
    }
  }
  rankChanges.sort((a, b) => a.proposedRank - b.proposedRank);

  return { predictionChanges, rankChanges };
}
