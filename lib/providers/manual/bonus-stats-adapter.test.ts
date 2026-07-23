import { describe, expect, it } from "vitest";
import { normalizeManualBonusStatsInput } from "./bonus-stats-adapter";
import fixture from "../fixtures/manual-bonus-stats.json";

describe("normalizeManualBonusStatsInput", () => {
  const result = normalizeManualBonusStatsInput(fixture);

  it("drops a category with an empty statKey and flags it", () => {
    expect(result.stats.find((s) => s.statKey === "")).toBeUndefined();
    expect(
      result.warnings.some((w) => w.message.includes("shape validation")),
    ).toBe(true);
  });

  it("ranks valid entries competition-style, ties sharing a rank", () => {
    const topScorer = result.stats.find((s) => s.statKey === "top_scorer");
    expect(
      topScorer?.entries.map((e) => ({
        refId: e.refId,
        value: e.value,
        rank: e.rank,
      })),
    ).toEqual([
      { refId: "p1", value: 5, rank: 1 },
      { refId: "p2", value: 5, rank: 1 },
      { refId: "p3", value: 2, rank: 3 },
    ]);
  });

  it("drops an entry with an empty label and flags it", () => {
    const topScorer = result.stats.find((s) => s.statKey === "top_scorer");
    expect(topScorer?.entries).toHaveLength(3);
    expect(result.warnings.some((w) => w.refId === "top_scorer-entry-3")).toBe(
      true,
    );
  });
});
