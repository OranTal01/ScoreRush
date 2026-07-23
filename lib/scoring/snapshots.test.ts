/**
 * Unit coverage for `captureLeaderboardSnapshot`'s DB-orchestration branches
 * (the pure ranking math itself is covered by leaderboard.test.ts). Mocks
 * `@/lib/db/client` — same rationale as lib/scoring/recompute.test.ts: this
 * is orchestration (summing scored prediction rows per participant, diffing
 * against the latest stored batch, inserting only on change) independent of
 * the actual SQL, and `lib/db/client.ts` carries `import "server-only"`.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { selectQueue, insertCalls } = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertCalls: [] as { table: unknown; values: unknown }[],
}));

function queuedWhere() {
  const value = selectQueue.shift() ?? [];
  const promise = Promise.resolve(value);
  return {
    limit: () => promise,
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
}

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(() => ({ from: () => ({ where: queuedWhere }) })),
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        insertCalls.push({ table, values });
        return Promise.resolve(undefined);
      },
    })),
  },
}));

const { captureLeaderboardSnapshot } = await import("./snapshots");
const { leaderboardSnapshots } = await import("@/lib/db/schema/predictions");

const T1 = "tournament-1";
const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  selectQueue.length = 0;
  insertCalls.length = 0;
});

describe("captureLeaderboardSnapshot", () => {
  it("does nothing when the tournament has no participants", async () => {
    selectQueue.push([]); // participants — none

    const result = await captureLeaderboardSnapshot(T1);

    expect(result).toEqual({ tournamentId: T1, captured: false, participantsCount: 0 });
    expect(insertCalls).toHaveLength(0);
  });

  it("captures a first snapshot (ranked, totals summed) when no prior batch exists", async () => {
    selectQueue.push([{ id: P1 }, { id: P2 }]); // participants
    selectQueue.push([{ id: "m1" }]); // matches
    selectQueue.push([
      { participantId: P1, pointsEarned: 9 },
      { participantId: P2, pointsEarned: 3 },
    ]); // match_predictions
    selectQueue.push([{ participantId: P1, pointsEarned: 6 }]); // group_predictions (P2 none)
    selectQueue.push([{ id: "c1" }]); // bonus_categories
    selectQueue.push([
      { participantId: P1, pointsEarned: 0 },
      { participantId: P2, pointsEarned: 20 },
    ]); // bonus_predictions
    selectQueue.push([]); // leaderboard_snapshots — no prior batch

    const result = await captureLeaderboardSnapshot(T1);

    expect(result).toEqual({ tournamentId: T1, captured: true, participantsCount: 2 });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe(leaderboardSnapshots);
    // P1: 9+6+0=15, P2: 3+0+20=23 -> P2 ranks 1st, P1 ranks 2nd.
    expect(insertCalls[0].values).toEqual([
      {
        tournamentId: T1,
        participantId: P2,
        rank: 1,
        totalPoints: 23,
        matchPoints: 3,
        groupRankingPoints: 0,
        bonusPoints: 20,
      },
      {
        tournamentId: T1,
        participantId: P1,
        rank: 2,
        totalPoints: 15,
        matchPoints: 9,
        groupRankingPoints: 6,
        bonusPoints: 0,
      },
    ]);
  });

  it("defaults to zero for participants with no matches or bonus categories yet", async () => {
    selectQueue.push([{ id: P1 }]); // participants
    selectQueue.push([]); // matches — none yet, skip match_predictions query
    selectQueue.push([{ participantId: P1, pointsEarned: 3 }]); // group_predictions
    selectQueue.push([]); // bonus_categories — none yet, skip bonus_predictions query
    selectQueue.push([]); // leaderboard_snapshots — no prior batch

    const result = await captureLeaderboardSnapshot(T1);

    expect(result).toEqual({ tournamentId: T1, captured: true, participantsCount: 1 });
    expect(insertCalls[0].values).toEqual([
      {
        tournamentId: T1,
        participantId: P1,
        rank: 1,
        totalPoints: 3,
        matchPoints: 0,
        groupRankingPoints: 3,
        bonusPoints: 0,
      },
    ]);
  });

  it("skips writing a new batch when standings are unchanged from the latest one", async () => {
    selectQueue.push([{ id: P1 }, { id: P2 }]); // participants
    selectQueue.push([{ id: "m1" }]); // matches
    selectQueue.push([
      { participantId: P1, pointsEarned: 9 },
      { participantId: P2, pointsEarned: 3 },
    ]); // match_predictions
    selectQueue.push([]); // group_predictions
    selectQueue.push([{ id: "c1" }]); // bonus_categories
    selectQueue.push([]); // bonus_predictions
    const capturedAt = new Date("2026-01-01T00:00:00.000Z");
    selectQueue.push([
      // Identical totals to the freshly computed standings (P1: 9, P2: 3).
      {
        tournamentId: T1,
        participantId: P1,
        rank: 1,
        totalPoints: 9,
        matchPoints: 9,
        groupRankingPoints: 0,
        bonusPoints: 0,
        capturedAt,
      },
      {
        tournamentId: T1,
        participantId: P2,
        rank: 2,
        totalPoints: 3,
        matchPoints: 3,
        groupRankingPoints: 0,
        bonusPoints: 0,
        capturedAt,
      },
    ]); // leaderboard_snapshots — latest batch, matches exactly

    const result = await captureLeaderboardSnapshot(T1);

    expect(result).toEqual({ tournamentId: T1, captured: false, participantsCount: 2 });
    expect(insertCalls).toHaveLength(0);
  });

  it("captures a new batch when standings differ from the latest one (only the most recent capturedAt group counts)", async () => {
    selectQueue.push([{ id: P1 }]); // participants
    selectQueue.push([]); // matches
    selectQueue.push([]); // group_predictions
    selectQueue.push([]); // bonus_categories
    const older = new Date("2026-01-01T00:00:00.000Z");
    const newest = new Date("2026-01-02T00:00:00.000Z");
    selectQueue.push([
      // An older batch that would (misleadingly) match if not filtered out...
      {
        tournamentId: T1,
        participantId: P1,
        rank: 1,
        totalPoints: 0,
        matchPoints: 0,
        groupRankingPoints: 0,
        bonusPoints: 0,
        capturedAt: older,
      },
      // ...but the latest batch has a different total, so this should still capture.
      {
        tournamentId: T1,
        participantId: P1,
        rank: 1,
        totalPoints: 50,
        matchPoints: 0,
        groupRankingPoints: 0,
        bonusPoints: 50,
        capturedAt: newest,
      },
    ]); // leaderboard_snapshots

    const result = await captureLeaderboardSnapshot(T1);

    expect(result).toEqual({ tournamentId: T1, captured: true, participantsCount: 1 });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].values).toEqual([
      {
        tournamentId: T1,
        participantId: P1,
        rank: 1,
        totalPoints: 0,
        matchPoints: 0,
        groupRankingPoints: 0,
        bonusPoints: 0,
      },
    ]);
  });
});
