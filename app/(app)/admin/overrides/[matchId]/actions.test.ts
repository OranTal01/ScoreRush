/**
 * Unit coverage for the manual match-result correction server actions
 * (ROADMAP.md Phase 7 task #61): `previewMatchCorrection` (read-only) and
 * `applyMatchCorrection` (writes). Mocks `@/lib/supabase/server` (same
 * fake-chain pattern as app/(app)/admin/participants/actions.test.ts, for
 * the `requireAdmin` auth/admin-context checks) and `@/lib/db/client` (same
 * synchronous-queue pattern as app/(app)/admin/tournaments/new/actions.test.ts,
 * for both plain `db.select()` reads and `db.transaction()` writes).
 * `@/lib/scoring/recompute` and `@/lib/scoring/snapshots` are mocked at the
 * function level — this file exercises the action's own orchestration
 * (validation, admin gating, preview computation, write shape, which
 * tournamentId gets recomputed/snapshotted), not those already-tested
 * pipelines themselves.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  fromQueue,
  selectQueue,
  insertCalls,
  updateCalls,
  authUser,
  recomputeCalls,
  snapshotCalls,
} = vi.hoisted(() => ({
  fromQueue: [] as { data: unknown }[],
  selectQueue: [] as unknown[][],
  insertCalls: [] as { table: unknown; values: unknown }[],
  updateCalls: [] as { table: unknown; values: unknown }[],
  authUser: { current: null as { id: string } | null },
  recomputeCalls: [] as string[],
  snapshotCalls: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: authUser.current } }),
    },
    from: () => {
      const response = fromQueue.shift() ?? { data: null };
      const promise = Promise.resolve(response);
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => promise,
      };
      return chain;
    },
  }),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => {
      const chain: {
        from: () => typeof chain;
        where: () => typeof chain;
        limit: () => Promise<unknown[]>;
        then: Promise<unknown[]>["then"];
      } = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(selectQueue.shift() ?? []),
        then: (resolve, reject) =>
          Promise.resolve(selectQueue.shift() ?? []).then(resolve, reject),
      };
      return chain;
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        update: (table: unknown) => ({
          set: (values: unknown) => ({
            where: () => {
              updateCalls.push({ table, values });
              return Promise.resolve(undefined);
            },
          }),
        }),
        insert: (table: unknown) => ({
          values: (values: unknown) => {
            insertCalls.push({ table, values });
            return Promise.resolve(undefined);
          },
        }),
      };
      return fn(tx);
    },
  },
}));

vi.mock("@/lib/scoring/recompute", () => ({
  DEFAULT_SCORING_RULES: {
    exactScorePoints: 9,
    winnerAndDiffPoints: 6,
    winnerOnlyPoints: 3,
    wrongPoints: 0,
    groupRankingPointsPerPosition: 3,
  },
  recomputeTournamentScores: vi.fn(async (tournamentId: string) => {
    recomputeCalls.push(tournamentId);
    return {
      tournamentId,
      matchPredictionsScored: 0,
      groupPredictionsScored: 0,
      groupStageFinalized: false,
      bonusPredictionsScored: 0,
    };
  }),
}));

const { matchPointsMap, groupPointsMap, bonusPointsMap } = vi.hoisted(() => ({
  matchPointsMap: { current: new Map<string, number>() },
  groupPointsMap: { current: new Map<string, number>() },
  bonusPointsMap: { current: new Map<string, number>() },
}));

vi.mock("@/lib/scoring/snapshots", () => ({
  captureLeaderboardSnapshot: vi.fn(async (tournamentId: string) => {
    snapshotCalls.push(tournamentId);
    return { tournamentId, captured: true, participantsCount: 0 };
  }),
  sumMatchPoints: vi.fn(async () => matchPointsMap.current),
  sumGroupPoints: vi.fn(async () => groupPointsMap.current),
  sumBonusPoints: vi.fn(async () => bonusPointsMap.current),
}));

const { previewMatchCorrection, applyMatchCorrection } = await import(
  "./actions"
);
const { matches } = await import("@/lib/db/schema/competition");
const { adminOverrides, scoreAuditLogs } = await import(
  "@/lib/db/schema/audit"
);

const MATCH_ID = "11111111-1111-4111-8111-111111111111";
const TOURNAMENT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_TOURNAMENT_ID = "99999999-9999-4999-8999-999999999999";
const P1 = "33333333-3333-4333-8333-333333333333";
const ADMIN_USER_ID = "44444444-4444-4444-8444-444444444444";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const CORRECTION_FIELDS = {
  matchId: MATCH_ID,
  tournamentId: TOURNAMENT_ID,
  proposedHome: "2",
  proposedAway: "1",
};

beforeEach(() => {
  fromQueue.length = 0;
  selectQueue.length = 0;
  insertCalls.length = 0;
  updateCalls.length = 0;
  recomputeCalls.length = 0;
  snapshotCalls.length = 0;
  authUser.current = null;
  matchPointsMap.current = new Map();
  groupPointsMap.current = new Map();
  bonusPointsMap.current = new Map();
});

describe("previewMatchCorrection", () => {
  it("rejects invalid input before touching auth", async () => {
    const result = await previewMatchCorrection(
      { status: "idle" },
      formData({ ...CORRECTION_FIELDS, matchId: "not-a-uuid" }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
  });

  it("rejects an unauthenticated caller", async () => {
    authUser.current = null;
    const result = await previewMatchCorrection(
      { status: "idle" },
      formData(CORRECTION_FIELDS),
    );
    expect(result).toEqual({ status: "error", code: "unauthenticated" });
  });

  it("rejects a caller who isn't an admin of the tournament", async () => {
    authUser.current = { id: ADMIN_USER_ID };
    fromQueue.push({ data: { is_platform_admin: false } });
    fromQueue.push({ data: { role: "participant" } });
    const result = await previewMatchCorrection(
      { status: "idle" },
      formData(CORRECTION_FIELDS),
    );
    expect(result).toEqual({ status: "error", code: "not_admin" });
  });

  it("returns not_found when the match doesn't belong to the submitted tournament", async () => {
    authUser.current = { id: ADMIN_USER_ID };
    fromQueue.push({ data: { is_platform_admin: true } });
    fromQueue.push({ data: null });
    selectQueue.push([]); // matchRow lookup finds nothing for this tournamentId

    const result = await previewMatchCorrection(
      { status: "idle" },
      formData(CORRECTION_FIELDS),
    );
    expect(result).toEqual({ status: "error", code: "not_found" });
  });

  it("computes the points/rank delta for the proposed result", async () => {
    authUser.current = { id: ADMIN_USER_ID };
    fromQueue.push({ data: { is_platform_admin: true } });
    fromQueue.push({ data: null });
    selectQueue.push([{ id: MATCH_ID }]); // matchRow
    selectQueue.push([]); // rulesRows -> falls back to DEFAULT_SCORING_RULES
    selectQueue.push([
      { participantId: P1, predictedHome: 2, predictedAway: 1, pointsEarned: 0 },
    ]); // predictionRows
    selectQueue.push([{ id: P1, displayName: "Alice" }]); // tournamentParticipants
    matchPointsMap.current = new Map([[P1, 10]]);

    const result = await previewMatchCorrection(
      { status: "idle" },
      formData(CORRECTION_FIELDS),
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("unreachable");
    expect(result.proposedHome).toBe(2);
    expect(result.proposedAway).toBe(1);
    expect(result.preview.predictionChanges).toEqual([
      {
        participantId: P1,
        displayName: "Alice",
        outcome: "exact",
        points: 9,
        previousPoints: 0,
        pointsDelta: 9,
      },
    ]);
  });
});

describe("applyMatchCorrection", () => {
  const APPLY_FIELDS = {
    ...CORRECTION_FIELDS,
    reason: "football-data.org returned a stale score, confirmed via broadcast",
    evidenceRef: "https://example.com/broadcast-clip",
    reversible: "on",
  };

  it("rejects invalid input (missing reason) before touching auth", async () => {
    const result = await applyMatchCorrection(
      { status: "idle" },
      formData({ ...CORRECTION_FIELDS, reason: "" }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
  });

  it("rejects an unauthenticated caller", async () => {
    authUser.current = null;
    const result = await applyMatchCorrection(
      { status: "idle" },
      formData(APPLY_FIELDS),
    );
    expect(result).toEqual({ status: "error", code: "unauthenticated" });
  });

  it("rejects a caller who isn't an admin of the tournament", async () => {
    authUser.current = { id: ADMIN_USER_ID };
    fromQueue.push({ data: { is_platform_admin: false } });
    fromQueue.push({ data: { role: "participant" } });
    const result = await applyMatchCorrection(
      { status: "idle" },
      formData(APPLY_FIELDS),
    );
    expect(result).toEqual({ status: "error", code: "not_admin" });
  });

  it("returns not_found when the match belongs to a different tournament than submitted", async () => {
    authUser.current = { id: ADMIN_USER_ID };
    fromQueue.push({ data: { is_platform_admin: true } });
    fromQueue.push({ data: null });
    selectQueue.push([
      { tournamentId: OTHER_TOURNAMENT_ID, regularResult: null, winner: null },
    ]);

    const result = await applyMatchCorrection(
      { status: "idle" },
      formData(APPLY_FIELDS),
    );
    expect(result).toEqual({ status: "error", code: "not_found" });
  });

  it("writes the match update, admin_overrides, and score_audit_logs rows, then recomputes and snapshots", async () => {
    authUser.current = { id: ADMIN_USER_ID };
    fromQueue.push({ data: { is_platform_admin: true } });
    fromQueue.push({ data: null });
    selectQueue.push([
      {
        tournamentId: TOURNAMENT_ID,
        regularResult: { home: 1, away: 1 },
        winner: "draw",
      },
    ]);

    const result = await applyMatchCorrection(
      { status: "idle" },
      formData(APPLY_FIELDS),
    );

    expect(result).toEqual({ status: "success" });

    const matchUpdate = updateCalls.find((c) => c.table === matches);
    expect(matchUpdate?.values).toEqual({
      regularResult: { home: 2, away: 1 },
      winner: "home",
      status: "finished",
      normalizationStatus: "normalized",
      warningFlag: null,
    });

    const overrideInsert = insertCalls.find((c) => c.table === adminOverrides);
    expect(overrideInsert?.values).toEqual({
      tournamentId: TOURNAMENT_ID,
      reason: APPLY_FIELDS.reason,
      evidenceRef: APPLY_FIELDS.evidenceRef,
      enteredBy: ADMIN_USER_ID,
      reversible: true,
    });

    const auditInsert = insertCalls.find((c) => c.table === scoreAuditLogs);
    expect(auditInsert?.values).toEqual([
      {
        tournamentId: TOURNAMENT_ID,
        entity: "match",
        entityId: MATCH_ID,
        field: "regular_result",
        previousValue: { home: 1, away: 1 },
        newValue: { home: 2, away: 1 },
        reason: APPLY_FIELDS.reason,
        actingUserId: ADMIN_USER_ID,
      },
      {
        tournamentId: TOURNAMENT_ID,
        entity: "match",
        entityId: MATCH_ID,
        field: "winner",
        previousValue: "draw",
        newValue: "home",
        reason: APPLY_FIELDS.reason,
        actingUserId: ADMIN_USER_ID,
      },
    ]);

    expect(recomputeCalls).toEqual([TOURNAMENT_ID]);
    expect(snapshotCalls).toEqual([TOURNAMENT_ID]);
  });

  it("omits the winner audit row when the proposed winner is unchanged", async () => {
    authUser.current = { id: ADMIN_USER_ID };
    fromQueue.push({ data: { is_platform_admin: true } });
    fromQueue.push({ data: null });
    selectQueue.push([
      {
        tournamentId: TOURNAMENT_ID,
        regularResult: { home: 1, away: 0 },
        winner: "home",
      },
    ]);

    await applyMatchCorrection({ status: "idle" }, formData(APPLY_FIELDS));

    const auditInsert = insertCalls.find((c) => c.table === scoreAuditLogs);
    expect((auditInsert?.values as unknown[]).length).toBe(1);
  });

  it("treats an absent reversible checkbox as false", async () => {
    authUser.current = { id: ADMIN_USER_ID };
    fromQueue.push({ data: { is_platform_admin: true } });
    fromQueue.push({ data: null });
    selectQueue.push([
      { tournamentId: TOURNAMENT_ID, regularResult: null, winner: null },
    ]);

    const fields = { ...APPLY_FIELDS };
    delete (fields as { reversible?: string }).reversible;
    await applyMatchCorrection({ status: "idle" }, formData(fields));

    const overrideInsert = insertCalls.find((c) => c.table === adminOverrides);
    expect(overrideInsert?.values).toMatchObject({ reversible: false });
  });
});
