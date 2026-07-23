/**
 * Unit coverage for `recomputeTournamentScores`'s DB-orchestration branches
 * (the pure scoring math itself is already covered by match-scoring.test.ts,
 * group-scoring.test.ts, bonus-scoring.test.ts, group-standings.test.ts).
 * Mocks `@/lib/db/client` rather than hitting a real database — same
 * rationale as lib/sync/upsert-matches.test.ts: this is pure orchestration
 * logic independent of the actual SQL, and `lib/db/client.ts` carries
 * `import "server-only"`. End-to-end verification against real/fixture
 * data happens separately (ROADMAP.md Phase 5 exit criteria, task #51).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { selectQueue, updateCalls } = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  updateCalls: [] as { table: unknown; values: unknown }[],
}));

/** Supports both `await db.select().from(t).where(...)` (awaited directly)
 * and `await db.select().from(t).where(...).limit(n)` (recompute.ts uses
 * both forms) by returning a thenable that also exposes `.limit()`. */
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
    update: vi.fn((table: unknown) => ({
      set: (values: unknown) => {
        updateCalls.push({ table, values });
        return { where: () => Promise.resolve(undefined) };
      },
    })),
  },
}));

const { recomputeTournamentScores } = await import("./recompute");
const { matchPredictions, groupPredictions, bonusPredictions } = await import(
  "@/lib/db/schema/predictions"
);

beforeEach(() => {
  selectQueue.length = 0;
  updateCalls.length = 0;
});

describe("recomputeTournamentScores", () => {
  it("scores finished-match predictions, leaves group stage unfinalized while incomplete, and scores bonus picks only for categories with a resolved snapshot", async () => {
    // 1. tournaments select (status)
    selectQueue.push([{ status: "active" }]);
    // 2. scoringRules select — none configured, falls back to defaults
    selectQueue.push([]);
    // 3. matches select — one finished group match, one still scheduled
    //    (so the group stage as a whole is incomplete)
    selectQueue.push([
      {
        id: "m1",
        status: "finished",
        group: "A",
        homeTeamId: "h1",
        awayTeamId: "h2",
        regularResult: { home: 2, away: 1 },
      },
      {
        id: "m2",
        status: "scheduled",
        group: "A",
        homeTeamId: "h3",
        awayTeamId: "h4",
        regularResult: null,
      },
    ]);
    // 4. match_predictions select (scoped to finished matches only)
    selectQueue.push([
      {
        id: "mp1",
        matchId: "m1",
        predictedHome: 2,
        predictedAway: 1,
      },
    ]);
    // group stage incomplete -> recomputeGroupPredictions returns early,
    // no group_predictions select happens.
    // 5. bonus_categories select
    selectQueue.push([
      {
        id: "catA",
        resolvesAt: "ongoing",
      },
      {
        id: "catB",
        resolvesAt: "ongoing",
      },
    ]);
    // 6. catA bonus_stats select — resolved winner
    selectQueue.push([{ refId: null, label: "Player X", rank: 1 }]);
    // 7. catA bonus_slots select
    selectQueue.push([{ id: "slotA", points: 20 }]);
    // 8. catA bonus_predictions select — one matching pick
    selectQueue.push([
      {
        id: "pickA",
        slotId: "slotA",
        pickLabel: "Player X",
        pickRefId: null,
      },
    ]);
    // 9. catB bonus_stats select — no resolved snapshot yet -> skipped,
    //    no slots/predictions query for catB at all.
    selectQueue.push([]);

    const result = await recomputeTournamentScores("tid");

    expect(result).toEqual({
      tournamentId: "tid",
      matchPredictionsScored: 1,
      groupPredictionsScored: 0,
      groupStageFinalized: false,
      bonusPredictionsScored: 1,
    });

    const matchUpdate = updateCalls.find((c) => c.table === matchPredictions);
    expect(matchUpdate?.values).toEqual({ pointsEarned: 9, outcome: "exact" });

    expect(updateCalls.some((c) => c.table === groupPredictions)).toBe(false);

    const bonusUpdate = updateCalls.find((c) => c.table === bonusPredictions);
    expect(bonusUpdate?.values).toEqual({ pointsEarned: 20 });
  });

  it("finalizes and scores group predictions once every group match is finished", async () => {
    selectQueue.push([{ status: "active" }]); // tournaments
    selectQueue.push([
      {
        exactScorePoints: 9,
        winnerAndDiffPoints: 6,
        winnerOnlyPoints: 3,
        wrongPoints: 0,
        groupRankingPointsPerPosition: 3,
      },
    ]); // scoringRules
    selectQueue.push([
      {
        id: "m1",
        status: "finished",
        group: "A",
        homeTeamId: "h1",
        awayTeamId: "h2",
        regularResult: { home: 2, away: 1 },
      },
    ]); // matches — the group's only match, already finished
    selectQueue.push([]); // match_predictions (none)
    selectQueue.push([
      {
        id: "gp1",
        group: "A",
        predictedOrder: ["h1", "h2"],
      },
    ]); // group_predictions
    selectQueue.push([]); // bonus_categories (none)

    const result = await recomputeTournamentScores("tid");

    expect(result.groupStageFinalized).toBe(true);
    expect(result.groupPredictionsScored).toBe(1);

    const groupUpdate = updateCalls.find((c) => c.table === groupPredictions);
    // h1 finished 2-1 over h2 -> h1 1st, h2 2nd; predicted exactly that
    // order -> both positions correct -> 2 * 3 points.
    expect(groupUpdate?.values).toEqual({ pointsEarned: 6, finalized: true });
  });

  it("does not score a terminal bonus category before the tournament is finished", async () => {
    selectQueue.push([{ status: "active" }]); // tournaments — not finished yet
    selectQueue.push([]); // scoringRules
    selectQueue.push([]); // matches
    // no match_predictions select — finishedMatches is empty
    // no group_predictions select — no group matches at all
    selectQueue.push([
      { id: "catChampion", resolvesAt: "tournament_end" },
    ]); // bonus_categories — terminal, skipped before any further query

    const result = await recomputeTournamentScores("tid");

    expect(result.bonusPredictionsScored).toBe(0);
    expect(updateCalls).toHaveLength(0);
  });
});
