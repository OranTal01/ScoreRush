/**
 * Unit coverage for `computePredictionStreaks` (lib/scoring/streaks.ts).
 * Exercises: kickoff-recency ordering (not input order), the "exact" vs
 * "not wrong" streak distinction, unscored entries being excluded rather
 * than breaking a streak, and the zero-scored-predictions edge case.
 */
import { describe, expect, it } from "vitest";
import { computePredictionStreaks } from "./streaks";

describe("computePredictionStreaks", () => {
  it("returns zero streaks and null accuracy for no entries", () => {
    expect(computePredictionStreaks([])).toEqual({
      exactStreak: 0,
      correctStreak: 0,
      accuracyPercent: null,
    });
  });

  it("ignores unscored (null outcome) entries entirely", () => {
    const result = computePredictionStreaks([
      { kickoff: "2026-06-03T00:00:00Z", outcome: null },
      { kickoff: "2026-06-02T00:00:00Z", outcome: "exact" },
      { kickoff: "2026-06-01T00:00:00Z", outcome: "exact" },
    ]);
    expect(result).toEqual({
      exactStreak: 2,
      correctStreak: 2,
      accuracyPercent: 100,
    });
  });

  it("orders by kickoff, not input array order", () => {
    const result = computePredictionStreaks([
      { kickoff: "2026-06-01T00:00:00Z", outcome: "wrong" },
      { kickoff: "2026-06-03T00:00:00Z", outcome: "exact" },
      { kickoff: "2026-06-02T00:00:00Z", outcome: "winner" },
    ]);
    // Most recent (06-03) is "exact" -> both streaks start counting there.
    expect(result.exactStreak).toBe(1);
    // 06-03 exact, 06-02 winner (not wrong) -> correctStreak continues; 06-01 wrong breaks it.
    expect(result.correctStreak).toBe(2);
  });

  it("stops the exact streak at the first non-exact outcome but keeps counting the correct streak", () => {
    const result = computePredictionStreaks([
      { kickoff: "2026-06-03T00:00:00Z", outcome: "exact" },
      { kickoff: "2026-06-02T00:00:00Z", outcome: "winner_diff" },
      { kickoff: "2026-06-01T00:00:00Z", outcome: "wrong" },
    ]);
    expect(result.exactStreak).toBe(1);
    expect(result.correctStreak).toBe(2);
  });

  it("computes accuracyPercent as the rounded percent of non-wrong outcomes", () => {
    const result = computePredictionStreaks([
      { kickoff: "2026-06-04T00:00:00Z", outcome: "exact" },
      { kickoff: "2026-06-03T00:00:00Z", outcome: "wrong" },
      { kickoff: "2026-06-02T00:00:00Z", outcome: "wrong" },
    ]);
    expect(result.accuracyPercent).toBe(33);
    // Most recent (06-04) is "exact" -> both streaks are 1 before 06-03 breaks them.
    expect(result.exactStreak).toBe(1);
    expect(result.correctStreak).toBe(1);
  });
});
