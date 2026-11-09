import { describe, expect, it } from "vitest";
import { predictMatchScore } from "./auto-model";

const rules = {
  exactScorePoints: 9,
  winnerAndDiffPoints: 6,
  winnerOnlyPoints: 3,
  wrongPoints: 0,
};

describe("automatic score model", () => {
  it("favors a historically stronger visitor and remains deterministic", () => {
    const now = new Date("2026-11-04T08:00:00Z");
    const history = [
      {
        homeTeamId: "weak",
        awayTeamId: "strong",
        home: 0,
        away: 3,
        kickoff: new Date("2026-10-20T20:00:00Z"),
      },
      {
        homeTeamId: "strong",
        awayTeamId: "weak",
        home: 4,
        away: 0,
        kickoff: new Date("2026-10-28T20:00:00Z"),
      },
    ];
    const result = predictMatchScore("weak", "strong", history, rules, now);
    expect(result.away).toBeGreaterThan(result.home);
    expect(predictMatchScore("weak", "strong", history, rules, now)).toEqual(
      result,
    );
  });
  it("uses prior rates when teams have no results", () => {
    const result = predictMatchScore(
      "new-home",
      "new-away",
      [],
      rules,
      new Date("2026-11-04T08:00:00Z"),
    );
    expect(result.home).toBeGreaterThanOrEqual(0);
    expect(result.away).toBeGreaterThanOrEqual(0);
    expect(result.home).toBeLessThanOrEqual(4);
    expect(result.away).toBeLessThanOrEqual(4);
  });
});
