import { describe, expect, it } from "vitest";
import {
  calculateGroupStandings,
  isGroupStageComplete,
  standingsByGroup,
  type StandingsMatch,
} from "./group-standings";

function match(overrides: Partial<StandingsMatch>): StandingsMatch {
  return {
    status: "scheduled",
    group: null,
    homeTeamId: "home",
    awayTeamId: "away",
    regularResult: null,
    ...overrides,
  };
}

describe("calculateGroupStandings", () => {
  it("orders teams by points desc, tie-breaking by teamId asc when points/GD/GF are all equal", () => {
    const matches: StandingsMatch[] = [
      match({
        group: "a",
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        status: "finished",
        regularResult: { home: 2, away: 0 },
      }),
      match({
        group: "a",
        homeTeamId: "team-c",
        awayTeamId: "team-d",
        status: "finished",
        regularResult: { home: 1, away: 1 },
      }),
    ];

    const groupA = calculateGroupStandings(matches);

    // team-a: 1W, 3pts, GD+2 -> 1st. team-c/team-d: 1D each, 1pt, GD0, GF1
    // each -> fully tied, so alphabetical teamId break puts team-c before
    // team-d. team-b: 1L, 0pts -> last.
    expect(groupA.map((s) => s.teamId)).toEqual([
      "team-a",
      "team-c",
      "team-d",
      "team-b",
    ]);
    expect(groupA[0]).toMatchObject({ position: 1, points: 3, goalDifference: 2 });
  });

  it("tie-breaks equal points and equal goal difference by goals-for", () => {
    const matches: StandingsMatch[] = [
      match({
        group: "b",
        homeTeamId: "team-p",
        awayTeamId: "team-q",
        status: "finished",
        regularResult: { home: 3, away: 1 },
      }),
      match({
        group: "b",
        homeTeamId: "team-r",
        awayTeamId: "team-s",
        status: "finished",
        regularResult: { home: 2, away: 0 },
      }),
    ];

    const groupB = calculateGroupStandings(matches);
    // team-p and team-r both have 3pts and GD+2, but team-p scored 3 goals
    // vs team-r's 2 -> team-p ranks above team-r.
    expect(groupB.map((s) => s.teamId)).toEqual([
      "team-p",
      "team-r",
      "team-q",
      "team-s",
    ]);
  });

  it("initializes teams with zeroed stats even with no finished matches yet", () => {
    const matches: StandingsMatch[] = [
      match({ group: "b", homeTeamId: "team-x", awayTeamId: "team-y" }),
    ];
    const standings = calculateGroupStandings(matches);
    expect(standings).toHaveLength(2);
    expect(standings.every((s) => s.played === 0 && s.points === 0)).toBe(
      true,
    );
  });

  it("ignores matches with no group (knockout stage)", () => {
    const matches: StandingsMatch[] = [
      match({
        group: null,
        status: "finished",
        regularResult: { home: 1, away: 0 },
      }),
    ];
    expect(calculateGroupStandings(matches)).toEqual([]);
  });
});

describe("isGroupStageComplete", () => {
  it("is false when there are no group-stage matches at all", () => {
    expect(isGroupStageComplete([match({ group: null })])).toBe(false);
  });

  it("is false while any group-stage match is unfinished", () => {
    const matches: StandingsMatch[] = [
      match({
        group: "a",
        status: "finished",
        regularResult: { home: 1, away: 0 },
      }),
      match({ group: "a", status: "scheduled" }),
    ];
    expect(isGroupStageComplete(matches)).toBe(false);
  });

  it("is true only once every group-stage match is finished with a result", () => {
    const matches: StandingsMatch[] = [
      match({
        group: "a",
        status: "finished",
        regularResult: { home: 1, away: 0 },
      }),
      match({
        group: "b",
        status: "finished",
        regularResult: { home: 2, away: 2 },
      }),
    ];
    expect(isGroupStageComplete(matches)).toBe(true);
  });
});

describe("standingsByGroup", () => {
  it("returns team ids ordered by position within each group", () => {
    const rows = calculateGroupStandings([
      match({
        group: "a",
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        status: "finished",
        regularResult: { home: 1, away: 0 },
      }),
    ]);
    expect(standingsByGroup(rows).get("a")).toEqual(["team-a", "team-b"]);
  });
});
