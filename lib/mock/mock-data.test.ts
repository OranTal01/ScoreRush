import { describe, expect, it } from "vitest";
import {
  currentParticipant,
  currentParticipantId,
  groupPredictions,
  groupStandings,
  matchPredictions,
  matches,
  participants,
  teamById,
  teams,
} from "./index";

describe("mock data referential integrity", () => {
  it("every match references a valid team pair (or is a TBD knockout slot)", () => {
    for (const match of matches) {
      if (match.homeTeamId === "" && match.awayTeamId === "") continue; // TBD semifinal/final
      expect(() => teamById(match.homeTeamId)).not.toThrow();
      expect(() => teamById(match.awayTeamId)).not.toThrow();
    }
  });

  it("every match prediction references a real match and the current participant", () => {
    const matchIds = new Set(matches.map((m) => m.id));
    for (const prediction of matchPredictions) {
      expect(matchIds.has(prediction.matchId)).toBe(true);
      expect(prediction.participantId).toBe(currentParticipantId);
    }
  });

  it("`me`'s matchPoints exactly equals the sum of finished-match predictions", () => {
    const sum = matchPredictions
      .filter((p) => p.pointsEarned !== null)
      .reduce((total, p) => total + (p.pointsEarned ?? 0), 0);
    expect(sum).toBe(currentParticipant.matchPoints);
  });

  it("every participant's totalPoints equals matchPoints + groupRankingPoints + bonusPoints", () => {
    for (const participant of participants) {
      expect(participant.totalPoints).toBe(
        participant.matchPoints +
          participant.groupRankingPoints +
          participant.bonusPoints,
      );
    }
  });

  it("group predictions only reference teams from the correct group", () => {
    for (const prediction of groupPredictions) {
      const groupTeamIds = teams
        .filter((t) => t.group === prediction.group)
        .map((t) => t.id);
      expect([...prediction.predictedOrder].sort()).toEqual(
        [...groupTeamIds].sort(),
      );
    }
  });

  it("group standings cover every team in the group exactly once", () => {
    for (const group of ["A", "B"] as const) {
      const teamIds = teams.filter((t) => t.group === group).map((t) => t.id);
      const standingIds = groupStandings[group].map((s) => s.teamId);
      expect([...standingIds].sort()).toEqual([...teamIds].sort());
    }
  });

  it("leaderboard rank order matches descending totalPoints", () => {
    const sorted = [...participants].sort(
      (a, b) => b.totalPoints - a.totalPoints,
    );
    expect(sorted.map((p) => p.id)).toEqual(
      [...participants].sort((a, b) => a.rank - b.rank).map((p) => p.id),
    );
  });
});
