import { describe, expect, it } from "vitest";
import { raceContext, rankLabel } from "./race";
describe("competitive context", () => {
  const entries = [
    { id: "a", name: "א", rank: 1, total: 69 },
    { id: "b", name: "ב", rank: 2, total: 66 },
    { id: "c", name: "ג", rank: 2, total: 66 },
    { id: "d", name: "ד", rank: 4, total: 60 },
  ];
  it("compares against the next higher score, skipping tied neighbors", () => {
    expect(raceContext(entries, "c")).toMatchObject({
      tied: true,
      aboveGap: 3,
      leaderGap: 3,
      belowGap: 6,
    });
    expect(raceContext(entries, "d")).toMatchObject({
      aboveGap: 6,
      leaderGap: 9,
    });
  });
  it("handles shared first, a solo player, and no matching participant", () => {
    expect(rankLabel(1, true)).toBe("מקום ראשון משותף");
    expect(raceContext([entries[0]], "a")).toMatchObject({
      above: null,
      below: null,
      leaderGap: 0,
    });
    expect(raceContext(entries, "missing")).toBeNull();
  });
});
