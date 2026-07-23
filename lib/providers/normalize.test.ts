import { describe, expect, it } from "vitest";
import {
  deriveWinner,
  isValidMatchScore,
  rankByValue,
  toMatchScore,
} from "./normalize";

describe("toMatchScore", () => {
  it("returns null for a missing pair", () => {
    expect(toMatchScore(null)).toBeNull();
    expect(toMatchScore(undefined)).toBeNull();
  });

  it("returns null when either side hasn't been reported yet", () => {
    expect(toMatchScore({ home: 1, away: null })).toBeNull();
    expect(toMatchScore({ home: null, away: 0 })).toBeNull();
  });

  it("never fabricates a 0 for an unreported score", () => {
    const result = toMatchScore({ home: null, away: null });
    expect(result).toBeNull();
  });

  it("converts a fully-reported pair", () => {
    expect(toMatchScore({ home: 2, away: 1 })).toEqual({ home: 2, away: 1 });
  });
});

describe("isValidMatchScore", () => {
  it("accepts non-negative integer pairs", () => {
    expect(isValidMatchScore({ home: 0, away: 0 })).toBe(true);
    expect(isValidMatchScore({ home: 5, away: 4 })).toBe(true);
  });

  it("rejects negative scores", () => {
    expect(isValidMatchScore({ home: -1, away: 2 })).toBe(false);
  });

  it("rejects non-integer scores", () => {
    expect(isValidMatchScore({ home: 1.5, away: 2 })).toBe(false);
  });
});

describe("deriveWinner", () => {
  it("returns null for no result", () => {
    expect(deriveWinner(null)).toBeNull();
  });

  it("picks the side with more goals", () => {
    expect(deriveWinner({ home: 2, away: 1 })).toBe("home");
    expect(deriveWinner({ home: 1, away: 2 })).toBe("away");
  });

  it("returns draw on equal scores", () => {
    expect(deriveWinner({ home: 1, away: 1 })).toBe("draw");
  });
});

describe("rankByValue", () => {
  it("assigns competition ranking — ties share a rank, next rank skips accordingly", () => {
    const ranked = rankByValue([
      { refId: "a", label: "A", value: 5 },
      { refId: "b", label: "B", value: 5 },
      { refId: "c", label: "C", value: 3 },
      { refId: "d", label: "D", value: 1 },
    ]);
    expect(ranked.map((e) => e.rank)).toEqual([1, 1, 3, 4]);
  });

  it("sorts descending by value regardless of input order", () => {
    const ranked = rankByValue([
      { refId: "low", label: "Low", value: 1 },
      { refId: "high", label: "High", value: 9 },
    ]);
    expect(ranked.map((e) => e.refId)).toEqual(["high", "low"]);
  });

  it("returns an empty array for no entries", () => {
    expect(rankByValue([])).toEqual([]);
  });
});
