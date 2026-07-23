/**
 * Unit coverage for `computeStandings` (ROADMAP.md Phase 6 exit criteria:
 * "leaderboard and bonus table always agree (totalPoints = matchPoints +
 * groupRankingPoints + bonusPoints) under test"). Exercises the totalPoints
 * identity, competition ranking ("1-2-2-4") for ties, deterministic
 * participantId ordering within ties, and the empty-input edge case.
 */
import { describe, expect, it } from "vitest";
import { computeStandings } from "./leaderboard";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const P3 = "33333333-3333-4333-8333-333333333333";
const P4 = "44444444-4444-4444-8444-444444444444";

describe("computeStandings", () => {
  it("returns an empty list for empty input", () => {
    expect(computeStandings([])).toEqual([]);
  });

  it("computes totalPoints as the sum of the three parts for every entry", () => {
    const result = computeStandings([
      { participantId: P1, matchPoints: 10, groupRankingPoints: 2, bonusPoints: 5 },
    ]);
    expect(result).toEqual([
      {
        participantId: P1,
        matchPoints: 10,
        groupRankingPoints: 2,
        bonusPoints: 5,
        totalPoints: 17,
        rank: 1,
      },
    ]);
  });

  it("ranks strictly descending by totalPoints when there are no ties", () => {
    const result = computeStandings([
      { participantId: P1, matchPoints: 5, groupRankingPoints: 0, bonusPoints: 0 },
      { participantId: P2, matchPoints: 20, groupRankingPoints: 0, bonusPoints: 0 },
      { participantId: P3, matchPoints: 10, groupRankingPoints: 0, bonusPoints: 0 },
    ]);
    expect(result.map((r) => r.participantId)).toEqual([P2, P3, P1]);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("uses competition ranking (1-2-2-4) so tied totals share rank and the next distinct total skips positions", () => {
    const result = computeStandings([
      { participantId: P1, matchPoints: 10, groupRankingPoints: 0, bonusPoints: 0 },
      { participantId: P2, matchPoints: 10, groupRankingPoints: 0, bonusPoints: 0 },
      { participantId: P3, matchPoints: 8, groupRankingPoints: 0, bonusPoints: 0 },
      { participantId: P4, matchPoints: 5, groupRankingPoints: 0, bonusPoints: 0 },
    ]);
    // P1 and P2 tie for 1st (totalPoints 10) -> both rank 1.
    // P3 is next distinct total (8) -> rank 3, not 2 (skips the tied position).
    // P4 is last -> rank 4.
    expect(result.map((r) => ({ id: r.participantId, rank: r.rank }))).toEqual([
      { id: P1, rank: 1 },
      { id: P2, rank: 1 },
      { id: P3, rank: 3 },
      { id: P4, rank: 4 },
    ]);
  });

  it("breaks ties deterministically by ascending participantId", () => {
    // P2 sorts before P1 lexically; both have equal totals, so order must be [P1? no — P2, P1]... verified by localeCompare.
    const result = computeStandings([
      { participantId: P2, matchPoints: 10, groupRankingPoints: 0, bonusPoints: 0 },
      { participantId: P1, matchPoints: 10, groupRankingPoints: 0, bonusPoints: 0 },
    ]);
    expect(result.map((r) => r.participantId)).toEqual(
      [P1, P2].sort((a, b) => a.localeCompare(b)),
    );
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(1);
  });

  it("produces the same ordering for the same input regardless of input array order (determinism)", () => {
    const entries = [
      { participantId: P3, matchPoints: 3, groupRankingPoints: 0, bonusPoints: 0 },
      { participantId: P1, matchPoints: 9, groupRankingPoints: 0, bonusPoints: 0 },
      { participantId: P2, matchPoints: 6, groupRankingPoints: 0, bonusPoints: 0 },
    ];
    const shuffled = [entries[2], entries[0], entries[1]];
    expect(computeStandings(entries)).toEqual(computeStandings(shuffled));
  });
});
