/**
 * Unit coverage for `submitGroupPrediction`'s orchestration branches (Phase 5
 * exit criteria, ROADMAP.md: "predictions submitted, locked, and scored
 * correctly end-to-end" — this covers the "submitted" half; group
 * predictions have no time-based lock, only the finalized-flag RLS policy,
 * so there's no "locked" branch to exercise here the way there is for match/
 * bonus predictions). Mocks `@/lib/supabase/server` — same rationale as
 * app/(app)/predictions/[matchId]/actions.test.ts: this exercises the
 * defense-in-depth validation (exact-team-set check) and the upsert
 * orchestration, independent of the real RLS/SQL backstop.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { fromQueue, calls, authUser } = vi.hoisted(() => ({
  fromQueue: [] as { data: unknown; error: unknown }[],
  calls: [] as { table: string; op: string; payload: unknown }[],
  authUser: { current: null as { id: string } | null },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: authUser.current } }),
    },
    from: (table: string) => {
      const response = fromQueue.shift() ?? { data: null, error: null };
      const promise = Promise.resolve(response);
      const chain: {
        select: () => typeof chain;
        eq: () => typeof chain;
        order: () => typeof chain;
        limit: () => typeof chain;
        maybeSingle: () => Promise<unknown>;
        then: Promise<unknown>["then"];
        catch: Promise<unknown>["catch"];
        upsert: (payload: unknown, options?: unknown) => typeof chain;
      } = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: () => promise,
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),
        upsert: (payload: unknown) => {
          calls.push({ table, op: "upsert", payload });
          return chain;
        },
      };
      return chain;
    },
  }),
}));

const { submitGroupPrediction } = await import("./actions");

const T1 = "11111111-1111-4111-8111-111111111111";
const H1 = "22222222-2222-4222-8222-222222222222";
const H2 = "33333333-3333-4333-8333-333333333333";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  fromQueue.length = 0;
  calls.length = 0;
  authUser.current = null;
});

describe("submitGroupPrediction", () => {
  it("rejects malformed predictedOrder JSON", async () => {
    const result = await submitGroupPrediction(
      { status: "idle" },
      formData({ group: "A", predictedOrder: "not-json" }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
    expect(calls).toHaveLength(0);
  });

  it("rejects an unauthenticated caller", async () => {
    const result = await submitGroupPrediction(
      { status: "idle" },
      formData({
        group: "A",
        predictedOrder: JSON.stringify([H1, H2]),
      }),
    );
    expect(result).toEqual({ status: "error", code: "unauthenticated" });
  });

  it("rejects a caller with no current tournament participant row", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({ data: null, error: null }); // getCurrentParticipant — no row

    const result = await submitGroupPrediction(
      { status: "idle" },
      formData({
        group: "A",
        predictedOrder: JSON.stringify([H1, H2]),
      }),
    );
    expect(result).toEqual({ status: "error", code: "not_a_member" });
  });

  it("rejects a predicted order that isn't exactly the group's team set", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({ data: { id: "p1", tournament_id: T1 }, error: null }); // participant
    fromQueue.push({ data: [{ id: H1 }, { id: H2 }], error: null }); // group teams

    const result = await submitGroupPrediction(
      { status: "idle" },
      formData({
        group: "A",
        predictedOrder: JSON.stringify([H1, H1]), // duplicate, and missing H2
      }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
    expect(calls).toHaveLength(0);
  });

  it("upserts a valid predicted order and returns success", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({ data: { id: "p1", tournament_id: T1 }, error: null }); // participant
    fromQueue.push({ data: [{ id: H1 }, { id: H2 }], error: null }); // group teams
    fromQueue.push({ data: null, error: null }); // upsert succeeds

    const result = await submitGroupPrediction(
      { status: "idle" },
      formData({
        group: "A",
        predictedOrder: JSON.stringify([H1, H2]),
      }),
    );

    expect(result).toEqual({ status: "success", group: "A", predictedOrder: [H1, H2] });
    expect(calls).toEqual([
      {
        table: "group_predictions",
        op: "upsert",
        payload: {
          tournament_id: T1,
          participant_id: "p1",
          group: "A",
          predicted_order: [H1, H2],
        },
      },
    ]);
  });
});
