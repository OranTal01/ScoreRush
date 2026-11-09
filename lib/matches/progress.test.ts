import { describe, expect, it } from "vitest";
import { canEditPrediction, focusMatches, roundProgress } from "./progress";
import type { MatchWithTeams } from "./list";
const now = Date.parse("2026-09-12T12:00:00Z");
const m: MatchWithTeams = {
  id: "one",
  tournamentId: "t",
  stage: "league",
  group: null,
  matchday: 1,
  kickoff: "2026-09-10T19:00:00Z",
  lockTime: "2026-09-10T18:55:00Z",
  status: "finished",
  retrospectiveEntry: true,
  homeTeam: null,
  awayTeam: null,
  ownPrediction: null,
  regularResult: null,
  liveScore: null,
};
const pick = {
  predictedHome: 0,
  predictedAway: 0,
  pointsEarned: null,
  outcome: null,
};
const future: MatchWithTeams = {
  ...m,
  id: "future",
  matchday: 2,
  kickoff: "2026-10-13T19:00:00Z",
  lockTime: "2026-10-13T18:55:00Z",
  status: "scheduled",
  retrospectiveEntry: false,
};
describe("round focus and progress", () => {
  it("prioritizes missing originals, then moves to the next round once complete", () => {
    expect(focusMatches([future, m], now).map((m) => m.id)).toEqual(["one"]);
    expect(
      focusMatches([future, { ...m, ownPrediction: pick }], now).map(
        (m) => m.id,
      ),
    ).toEqual(["future"]);
  });
  it("does not count automatic zero draws as submitted, but accepts an explicit zero draw", () => {
    const r = roundProgress(
      [
        { ...future, ownPrediction: { ...pick, isDefault: true } },
        { ...future, id: "two", ownPrediction: pick },
      ],
      now,
    );
    expect(r.saved).toBe(1);
    expect(r.missing).toHaveLength(1);
  });
  it("ignores postponed games and locks at the exact cutoff", () => {
    expect(canEditPrediction(future, Date.parse(future.lockTime))).toBe(false);
    expect(
      roundProgress([{ ...future, status: "postponed" }, future], now).total,
    ).toBe(1);
    expect(canEditPrediction({ ...m, status: "cancelled" }, now)).toBe(false);
  });
  it("does not invent a deadline for retrospective entries", () => {
    expect(roundProgress([m], now)).toMatchObject({
      deadline: null,
      retrospective: true,
    });
    expect(roundProgress([], now)).toMatchObject({
      total: 0,
      saved: 0,
      missing: [],
    });
  });
});
