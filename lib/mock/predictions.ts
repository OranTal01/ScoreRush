import type { GroupPrediction, MatchPrediction } from "./types";
import { currentParticipantId } from "./participants";

/**
 * `me`'s match predictions. The 8 finished-match entries sum to exactly 51
 * points (9+6+9+0+9+6+9+3) under the SCORING-RULES.md §2 default 9/6/3/0
 * scale — matches `participants.ts`'s `matchPoints: 51` for `me`.
 *
 * The matchday-3 entries demonstrate every Predictions-screen state: a
 * locked prediction on the live match, an editable prediction on the match
 * still open today, and no prediction yet on the two matches open tomorrow.
 */
export const matchPredictions: MatchPrediction[] = [
  {
    id: "mp-1",
    matchId: "m-rm-mc",
    participantId: currentParticipantId,
    predictedHome: 2,
    predictedAway: 1,
    submittedAt: "2026-07-12T12:00:00+03:00",
    pointsEarned: 9,
    outcome: "exact",
  },
  {
    id: "mp-2",
    matchId: "m-bvb-int",
    participantId: currentParticipantId,
    predictedHome: 2,
    predictedAway: 2,
    submittedAt: "2026-07-12T13:30:00+03:00",
    pointsEarned: 6,
    outcome: "draw_correct",
  },
  {
    id: "mp-3",
    matchId: "m-bay-psg",
    participantId: currentParticipantId,
    predictedHome: 1,
    predictedAway: 0,
    submittedAt: "2026-07-12T09:00:00+03:00",
    pointsEarned: 9,
    outcome: "exact",
  },
  {
    id: "mp-4",
    matchId: "m-liv-ars",
    participantId: currentParticipantId,
    predictedHome: 1,
    predictedAway: 0,
    submittedAt: "2026-07-12T10:00:00+03:00",
    pointsEarned: 0,
    outcome: "wrong",
  },
  {
    id: "mp-5",
    matchId: "m-rm-bvb",
    participantId: currentParticipantId,
    predictedHome: 1,
    predictedAway: 1,
    submittedAt: "2026-07-19T08:00:00+03:00",
    pointsEarned: 9,
    outcome: "exact",
  },
  {
    id: "mp-6",
    matchId: "m-mc-int",
    participantId: currentParticipantId,
    predictedHome: 2,
    predictedAway: 0,
    submittedAt: "2026-07-19T08:30:00+03:00",
    pointsEarned: 6,
    outcome: "winner_diff",
  },
  {
    id: "mp-7",
    matchId: "m-bay-liv",
    participantId: currentParticipantId,
    predictedHome: 2,
    predictedAway: 1,
    submittedAt: "2026-07-19T09:00:00+03:00",
    pointsEarned: 9,
    outcome: "exact",
  },
  {
    id: "mp-8",
    matchId: "m-psg-ars",
    participantId: currentParticipantId,
    predictedHome: 1,
    predictedAway: 0,
    submittedAt: "2026-07-19T09:15:00+03:00",
    pointsEarned: 3,
    outcome: "winner",
  },
  // Live match — already locked, awaiting result.
  {
    id: "mp-9",
    matchId: "m-rm-int",
    participantId: currentParticipantId,
    predictedHome: 2,
    predictedAway: 0,
    submittedAt: "2026-07-21T20:00:00+03:00",
    pointsEarned: null,
    outcome: null,
  },
  // Still open today — editable prediction already saved once.
  {
    id: "mp-10",
    matchId: "m-mc-bvb",
    participantId: currentParticipantId,
    predictedHome: 1,
    predictedAway: 1,
    submittedAt: "2026-07-22T08:00:00+03:00",
    pointsEarned: null,
    outcome: null,
  },
  // No prediction yet for m-bay-ars / m-psg-liv (tomorrow) — intentionally
  // omitted to exercise the "no prediction yet" empty state.
];

export function predictionForMatch(matchId: string): MatchPrediction | null {
  return (
    matchPredictions.find(
      (p) => p.matchId === matchId && p.participantId === currentParticipantId,
    ) ?? null
  );
}

/**
 * `me`'s predicted final group standings. Not finalized — SCORING-RULES.md
 * §5 group points only post once the whole group stage completes.
 */
export const groupPredictions: GroupPrediction[] = [
  {
    group: "A",
    participantId: currentParticipantId,
    predictedOrder: ["rm", "mc", "bvb", "int"],
    pointsEarned: null,
    finalized: false,
  },
  {
    group: "B",
    participantId: currentParticipantId,
    predictedOrder: ["bay", "psg", "liv", "ars"],
    pointsEarned: null,
    finalized: false,
  },
];
