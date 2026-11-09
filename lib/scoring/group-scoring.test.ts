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

describe("league ranking bands", () => {
  const actual = Array.from({ length: 36 }, (_, i) => `team-${i + 1}`);
  const config = { mode: "bands", sizes: [8, 16, 12] } as const;
  const rules = { ...config, sizes: [...config.sizes] };
  it("awards all 108 points for correct bands, regardless of order inside each band", () => {
    const pick = [
      ...actual.slice(0, 8).reverse(),
      ...actual.slice(8, 24).reverse(),
      ...actual.slice(24).reverse(),
    ];
    expect(scoreGroupRanking(actual, pick, 3, rules)).toBe(108);
  });
  it("deducts only the two misplaced teams at either band boundary", () => {
    for (const boundary of [8, 24]) {
      const pick = [...actual];
      [pick[boundary - 1], pick[boundary]] = [
        pick[boundary],
        pick[boundary - 1],
      ];
      expect(scoreGroupRanking(actual, pick, 3, rules)).toBe(102);
    }
  });
  it("supports other band sizes and point values", () => {
    expect(
      scoreGroupRanking(["A", "B", "C", "D"], ["B", "A", "D", "C"], 5, {
        mode: "bands",
        sizes: [2, 2],
      }),
    ).toBe(20);
  });
  it("rejects duplicate teams, unknown teams and incomplete standings", () => {
    expect(() =>
      scoreGroupRanking(actual, [...actual.slice(0, 35), actual[0]], 3, rules),
    ).toThrow();
    expect(() =>
      scoreGroupRanking(actual, [...actual.slice(0, 35), "unknown"], 3, rules),
    ).toThrow();
    expect(() =>
      scoreGroupRanking(actual.slice(1), actual, 3, rules),
    ).toThrow();
  });
});
