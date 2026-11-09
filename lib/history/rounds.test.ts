import { describe, it, expect } from "vitest";
import {
  groupRounds,
  roundIsSettled,
  shouldCaptureRound,
  roundWinners,
  type HistoryMatch,
} from "./rounds";
const match: HistoryMatch = {
  id: "m",
  stage: "league_stage",
  matchday: 1,
  kickoff: "2026-09-08T19:00:00Z",
  status: "finished",
  regularResult: { home: 2, away: 1 },
  normalizationStatus: "normalized",
};
describe("round history", () => {
  it("groups matchdays across dates while keeping stages distinct", () => {
    const rounds = groupRounds([
      match,
      { ...match, id: "m2", kickoff: "2026-09-09T19:00:00Z" },
      { ...match, id: "m3", stage: "final" },
    ]);
    expect(rounds).toHaveLength(2);
    expect(rounds[0].matches).toHaveLength(2);
  });
  it("waits for the full round, valid scores and the end of onboarding", () => {
    expect(roundIsSettled([match], {})).toBe(true);
    expect(
      roundIsSettled([match], {
        onboarding_open: true,
        onboarding_matchday: 1,
      }),
    ).toBe(false);
    for (const status of ["live", "scheduled", "postponed"])
      expect(roundIsSettled([match, { ...match, status }], {})).toBe(false);
    expect(
      roundIsSettled([{ ...match, normalizationStatus: "flagged" }], {}),
    ).toBe(false);
    expect(roundIsSettled([{ ...match, regularResult: null }], {})).toBe(false);
    expect(roundIsSettled([{ ...match, status: "cancelled" }], {})).toBe(false);
    expect(roundIsSettled([match, { ...match, status: "cancelled" }], {})).toBe(
      true,
    );
  });
  it("captures only observed closures once, without inventing previous ranks", () => {
    expect(shouldCaptureRound(true, null, true, true)).toBe(true);
    expect(shouldCaptureRound(false, null, true, true)).toBe(false);
    expect(shouldCaptureRound(true, "timestamp", true, true)).toBe(false);
    expect(shouldCaptureRound(true, null, false, true)).toBe(false);
    expect(shouldCaptureRound(true, null, true, false)).toBe(false);
  });
  it("awards a shared round victory by round points rather than overall rank", () => {
    const a = {
      id: "a",
      name: "A",
      rank: 1,
      total: 50,
      roundPoints: 3,
      exact: 0,
    };
    const b = { ...a, id: "b", rank: 2, roundPoints: 9 };
    const c = { ...b, id: "c", rank: 3 };
    expect(roundWinners([a, b, c]).map((p) => p.id)).toEqual(["b", "c"]);
    expect(roundWinners([])).toEqual([]);
  });
});
