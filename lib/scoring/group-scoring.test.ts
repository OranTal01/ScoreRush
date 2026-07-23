/**
 * Scenarios mirror world-cup-bets/lib/scoring.test.ts `describe('scoreGroupRanking')`,
 * using the default 3-points-per-position value (SCORING-RULES.md §5).
 */
import { describe, expect, it } from "vitest";
import { scoreGroupRanking } from "./group-scoring";

describe("scoreGroupRanking", () => {
  it("awards 12 for all 4 positions correct", () => {
    expect(
      scoreGroupRanking(["A", "B", "C", "D"], ["A", "B", "C", "D"], 3),
    ).toBe(12);
  });

  it("awards 9 for 3 positions correct", () => {
    expect(
      scoreGroupRanking(["A", "B", "C", "D"], ["A", "B", "C", "X"], 3),
    ).toBe(9);
  });

  it("awards 6 for 2 positions correct", () => {
    expect(
      scoreGroupRanking(["A", "B", "C", "D"], ["A", "B", "X", "Y"], 3),
    ).toBe(6);
  });

  it("awards 3 for 1 position correct", () => {
    expect(
      scoreGroupRanking(["A", "B", "C", "D"], ["A", "X", "Y", "Z"], 3),
    ).toBe(3);
  });

  it("awards 0 for no positions correct (fully reversed)", () => {
    expect(
      scoreGroupRanking(["A", "B", "C", "D"], ["D", "C", "B", "A"], 3),
    ).toBe(0);
  });

  it("honors a non-default configured points-per-position value", () => {
    expect(scoreGroupRanking(["A", "B"], ["A", "B"], 5)).toBe(10);
  });
});
