/**
 * Unit coverage for `createTournament` (ROADMAP.md Phase 7 task #58).
 * Mocks `@/lib/supabase/server` (same fake-chain pattern as
 * app/(app)/groups/actions.test.ts) for the auth/isPlatformAdmin checks, and
 * `@/lib/db/client` (same pattern as lib/sync/upsert-matches.test.ts) for
 * the transactional writes — this exercises the guard branches (invalid
 * input, unauthenticated, not a platform admin) and the happy-path
 * insert-per-table orchestration, independent of the real RLS/SQL backstop.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { fromQueue, authUser, insertCalls, returningQueue } = vi.hoisted(
  () => ({
    fromQueue: [] as { data: unknown }[],
    authUser: { current: null as { id: string; email?: string } | null },
    insertCalls: [] as { table: unknown; values: unknown }[],
    returningQueue: [] as unknown[][],
  }),
);

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
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        insert: (table: unknown) => ({
          values: (values: unknown) => {
            insertCalls.push({ table, values });
            const base: Promise<unknown> & { returning?: () => Promise<unknown> } =
              Promise.resolve(undefined);
            base.returning = () => Promise.resolve(returningQueue.shift() ?? []);
            return base;
          },
        }),
      };
      return fn(tx);
    },
  },
}));

const { createTournament } = await import("./actions");
const { tournaments, participants } = await import(
  "@/lib/db/schema/identity"
);
const {
  scoringRules,
  bonusCategories,
  bonusSlots,
  prizes,
  tournamentProviders,
} = await import("@/lib/db/schema/config");
const { systemEvents } = await import("@/lib/db/schema/audit");

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const VALID_BASICS = {
  name: "Champions League 2027",
  competition: "champions_league",
  dataSource: "manual",
  exactScorePoints: "9",
  winnerAndDiffPoints: "6",
  winnerOnlyPoints: "3",
  wrongPoints: "0",
  groupRankingPointsPerPosition: "3",
  bonusCategories: "[]",
  prizes: "[]",
};

beforeEach(() => {
  fromQueue.length = 0;
  insertCalls.length = 0;
  returningQueue.length = 0;
  authUser.current = null;
});

describe("createTournament", () => {
  it("rejects invalid input before touching auth", async () => {
    const result = await createTournament(
      { status: "idle" },
      formData({ ...VALID_BASICS, name: "" }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
  });

  it("requires football_data_org tournaments to supply a competitionCode", async () => {
    const result = await createTournament(
      { status: "idle" },
      formData({ ...VALID_BASICS, dataSource: "football_data_org" }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
  });

  it("rejects an unauthenticated caller", async () => {
    authUser.current = null;
    const result = await createTournament(
      { status: "idle" },
      formData(VALID_BASICS),
    );
    expect(result).toEqual({ status: "error", code: "unauthenticated" });
  });

  it("rejects a caller who isn't the platform admin", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({ data: { is_platform_admin: false } });
    const result = await createTournament(
      { status: "idle" },
      formData(VALID_BASICS),
    );
    expect(result).toEqual({ status: "error", code: "not_platform_admin" });
  });

  it("creates the tournament and all its config rows in one transaction for the platform admin", async () => {
    authUser.current = { id: "u1", email: "u1@example.com" };
    fromQueue.push({ data: { is_platform_admin: true } }); // isPlatformAdmin
    fromQueue.push({ data: { display_name: "Oran" } }); // display name lookup
    returningQueue.push([{ id: "tournament-1" }]); // tournaments insert
    returningQueue.push([{ id: "cat-1" }]); // bonusCategories insert

    const result = await createTournament(
      { status: "idle" },
      formData({
        ...VALID_BASICS,
        bonusCategories: JSON.stringify([
          {
            name: "Top Scorer",
            type: "player",
            resolvesAt: "ongoing",
            duplicateStackingAllowed: true,
            slots: [{ points: "20" }, { points: "10" }],
          },
        ]),
        prizes: JSON.stringify([{ description: "VIP subscription" }]),
      }),
    );

    expect(result).toEqual({ status: "success", tournamentId: "tournament-1" });

    const tableOf = (table: unknown) =>
      insertCalls.filter((c) => c.table === table).map((c) => c.values);

    expect(tableOf(tournaments)).toEqual([
      { name: "Champions League 2027", competition: "champions_league", createdBy: "u1" },
    ]);
    expect(tableOf(scoringRules)).toEqual([
      {
        tournamentId: "tournament-1",
        exactScorePoints: 9,
        winnerAndDiffPoints: 6,
        winnerOnlyPoints: 3,
        wrongPoints: 0,
        groupRankingPointsPerPosition: 3,
      },
    ]);
    expect(tableOf(prizes)).toEqual([
      { tournamentId: "tournament-1", rank: 1, description: "VIP subscription" },
    ]);
    expect(tableOf(bonusCategories)).toEqual([
      {
        tournamentId: "tournament-1",
        name: "Top Scorer",
        type: "player",
        resolvesAt: "ongoing",
        duplicateStackingAllowed: true,
      },
    ]);
    expect(tableOf(bonusSlots)).toEqual([
      { categoryId: "cat-1", slotIndex: 1, points: 20 },
      { categoryId: "cat-1", slotIndex: 2, points: 10 },
    ]);
    expect(tableOf(tournamentProviders)).toEqual([
      {
        tournamentId: "tournament-1",
        matchDataProvider: "manual",
        matchDataConfig: { entries: [] },
        bonusStatsProvider: "manual",
        bonusStatsConfig: { stats: [] },
      },
    ]);
    expect(tableOf(participants)).toEqual([
      {
        tournamentId: "tournament-1",
        userId: "u1",
        role: "tournament_admin",
        displayName: "Oran",
      },
    ]);
    expect(tableOf(systemEvents)).toEqual([
      {
        tournamentId: "tournament-1",
        type: "tournament_created",
        payload: {
          name: "Champions League 2027",
          competition: "champions_league",
          createdBy: "u1",
        },
      },
    ]);
  });
});
