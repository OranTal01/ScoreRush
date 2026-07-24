/**
 * Unit coverage for `computeRecalculationPreview` (ROADMAP.md Phase 7 task
 * #61). Pure input/output assertions, no DB — same style as
 * leaderboard.test.ts/match-scoring.test.ts.
 */
import { describe, expect, it } from "vitest";
import { computeRecalculationPreview } from "./recalculation-preview";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const P3 = "33333333-3333-4333-8333-333333333333";

const RULES = {
  exactScorePoints: 9,
  winnerAndDiffPoints: 6,
  winnerOnlyPoints: 3,
  wrongPoints: 0,
};

const NAMES = new Map([
  [P1, "Alice"],
  [P2, "Bob"],
  [P3, "Cleo"],
]);

describe("computeRecalculationPreview", () => {
  it("rescopes every prediction against the proposed result and computes points deltas", () => {
    const result = computeRecalculationPreview({
      proposedResult: { home: 2, away: 1 },
      rules: RULES,
      predictions: [
        { participantId: P1, predicted: { home: 2, away: 1 }, previousPoints: 0 },
        { participantId: P2, predicted: { home: 3, away: 1 }, previousPoints: 6 },
        { participantId: P3, predicted: { home: 0, away: 0 }, previousPoints: 0 },
      ],
      currentStandings: [
        { participantId: P1, matchPoints: 10, groupRankingPoints: 0, bonusPoints: 0 },
        { participantId: P2, matchPoints: 10, groupRankingPoints: 0, bonusPoints: 0 },
        { participantId: P3, matchPoints: 10, groupRankingPoints: 0, bonusPoints: 0 },
      ],
      participantNames: NAMES,
    });

    expect(result.predictionChanges).toEqual([
      {
        participantId: P1,
        displayName: "Alice",
        outcome: "exact",
        points: 9,
        previousPoints: 0,
        pointsDelta: 9,
      },
      {
        participantId: P2,
        displayName: "Bob",
        outcome: "winner",
        points: 3,
        previousPoints: 6,
        pointsDelta: -3,
      },
      {
        participantId: P3,
        displayName: "Cleo",
        outcome: "wrong",
        points: 0,
        previousPoints: 0,
        pointsDelta: 0,
      },
    ]);
  });

  it("reports rank changes only for participants whose rank or total actually moves", () => {
    const result = computeRecalculationPreview({
      proposedResult: { home: 2, away: 1 },
      rules: RULES,
      predictions: [
        { participantId: P1, predicted: { home: 2, away: 1 }, previousPoints: 0 },
      ],
      currentStandings: [
        { participantId: P1, matchPoints: 10, groupRankingPoints: 0, bonusPoints: 0 },
        { participantId: P2, matchPoints: 15, groupRankingPoints: 0, bonusPoints: 0 },
        { participantId: P3, matchPoints: 5, groupRankingPoints: 0, bonusPoints: 0 },
      ],
      participantNames: NAMES,
    });

    // P1 gains 9 points (0 -> 9), moving from 10 -> 19 total, overtaking P2's 15.
    expect(result.rankChanges).toEqual([
      {
        participantId: P1,
        displayName: "Alice",
        previousRank: 2,
        proposedRank: 1,
        previousTotalPoints: 10,
        proposedTotalPoints: 19,
      },
      {
        participantId: P2,
        displayName: "Bob",
        previousRank: 1,
        proposedRank: 2,
        previousTotalPoints: 15,
        proposedTotalPoints: 15,
      },
    ]);
    // P3 is untouched by this match's correction entirely.
    expect(
      result.rankChanges.some((change) => change.participantId === P3),
    ).toBe(false);
  });

  it("returns no rank changes when the proposed result doesn't change any prediction's points", () => {
    const result = computeRecalculationPreview({
      proposedResult: { home: 1, away: 1 },
      rules: RULES,
      predictions: [
        { participantId: P1, predicted: { home: 1, away: 1 }, previousPoints: 9 },
      ],
      currentStandings: [
        { participantId: P1, matchPoints: 20, groupRankingPoints: 0, bonusPoints: 0 },
        { participantId: P2, matchPoints: 10, groupRankingPoints: 0, bonusPoints: 0 },
      ],
      participantNames: NAMES,
    });

    expect(result.predictionChanges[0]).toMatchObject({ pointsDelta: 0 });
    expect(result.rankChanges).toEqual([]);
  });

  it("falls back to the participantId when a display name isn't provided", () => {
    const result = computeRecalculationPreview({
      proposedResult: { home: 1, away: 0 },
      rules: RULES,
      predictions: [
        { participantId: P1, predicted: { home: 1, away: 0 }, previousPoints: 0 },
      ],
      currentStandings: [],
      participantNames: new Map(),
    });

    expect(result.predictionChanges[0].displayName).toBe(P1);
  });

  it("handles an empty prediction/standings set", () => {
    const result = computeRecalculationPreview({
      proposedResult: { home: 1, away: 0 },
      rules: RULES,
      predictions: [],
      currentStandings: [],
      participantNames: NAMES,
    });
    expect(result).toEqual({ predictionChanges: [], rankChanges: [] });
  });
});
