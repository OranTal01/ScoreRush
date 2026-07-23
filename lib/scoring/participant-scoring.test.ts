import { describe, expect, it } from "vitest";
import { aggregateParticipantScore, sumPoints } from "./participant-scoring";

describe("aggregateParticipantScore", () => {
  it("sums the three components into totalPoints", () => {
    expect(
      aggregateParticipantScore({
        matchPoints: 45,
        groupRankingPoints: 6,
        bonusPoints: 30,
      }),
    ).toEqual({
      matchPoints: 45,
      groupRankingPoints: 6,
      bonusPoints: 30,
      totalPoints: 81,
    });
  });

  it("handles all-zero components", () => {
    expect(
      aggregateParticipantScore({
        matchPoints: 0,
        groupRankingPoints: 0,
        bonusPoints: 0,
      }).totalPoints,
    ).toBe(0);
  });
});

describe("sumPoints", () => {
  it("sums the points field of a list of scored entries", () => {
    expect(sumPoints([{ points: 9 }, { points: 3 }, { points: 0 }])).toBe(12);
  });

  it("returns 0 for an empty list", () => {
    expect(sumPoints([])).toBe(0);
  });
});
