/**
 * Contract test against a fixture payload (ARCHITECTURE.md §9) — no network
 * call. `normalizeFootballDataScorersResponse` is exported specifically so
 * this test never has to touch `./client` (which requires
 * FOOTBALL_DATA_API_TOKEN and carries `import "server-only"`).
 */
import { describe, expect, it } from "vitest";
import { normalizeFootballDataScorersResponse } from "./bonus-stats-adapter";
import fixture from "../fixtures/football-data-scorers.json";

describe("normalizeFootballDataScorersResponse", () => {
  const result = normalizeFootballDataScorersResponse(fixture);

  it("drops the scorer entry with a missing player name and flags it", () => {
    expect(result.warnings.some((w) => w.refId === "999")).toBe(true);
    const topScorer = result.stats.find((s) => s.statKey === "top_scorer");
    expect(topScorer?.entries.find((e) => e.refId === "999")).toBeUndefined();
  });

  it("produces a top_scorer list ranked by goals, competition-style (ties share a rank)", () => {
    const topScorer = result.stats.find((s) => s.statKey === "top_scorer");
    expect(
      topScorer?.entries.map((e) => ({
        refId: e.refId,
        value: e.value,
        rank: e.rank,
      })),
    ).toEqual([
      { refId: "101", value: 6, rank: 1 },
      { refId: "102", value: 6, rank: 1 },
      { refId: "103", value: 4, rank: 3 },
      { refId: "104", value: 3, rank: 4 },
      { refId: "105", value: 1, rank: 5 },
    ]);
  });

  it("treats a null assists value as 0 rather than erroring", () => {
    const topAssists = result.stats.find((s) => s.statKey === "top_assists");
    const silva = topAssists?.entries.find((e) => e.refId === "102");
    expect(silva?.value).toBe(0);
  });

  it("produces a top_assists list ranked independently from goals", () => {
    const topAssists = result.stats.find((s) => s.statKey === "top_assists");
    expect(
      topAssists?.entries.map((e) => ({
        refId: e.refId,
        value: e.value,
        rank: e.rank,
      })),
    ).toEqual([
      { refId: "103", value: 5, rank: 1 },
      { refId: "104", value: 5, rank: 1 },
      { refId: "105", value: 3, rank: 3 },
      { refId: "101", value: 2, rank: 4 },
      { refId: "102", value: 0, rank: 5 },
    ]);
  });

  it("handles a missing scorers array without throwing", () => {
    const empty = normalizeFootballDataScorersResponse({});
    expect(empty.stats).toEqual([
      { statKey: "top_scorer", entries: [] },
      { statKey: "top_assists", entries: [] },
    ]);
    expect(empty.warnings).toHaveLength(1);
  });
});
