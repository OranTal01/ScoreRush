/**
 * Unit coverage for `submitBonusPrediction`'s orchestration branches (Phase 5
 * exit criteria, ROADMAP.md: "predictions submitted, locked, and scored
 * correctly end-to-end" — this covers the "submitted"/"locked" half; scoring
 * itself is covered by lib/scoring/bonus-scoring.test.ts and
 * recompute.test.ts). Mocks `@/lib/supabase/server` — same rationale as the
 * other app/(app)/*\/actions.test.ts files: exercises the lock pre-check,
 * slot-membership/duplicate-stacking validation (SCORING-RULES.md §6), and
 * upsert orchestration, independent of the real RLS/SQL backstop.
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
        maybeSingle: () => Promise<unknown>;
        then: Promise<unknown>["then"];
        catch: Promise<unknown>["catch"];
        upsert: (payload: unknown, options?: unknown) => typeof chain;
      } = {
        select: () => chain,
        eq: () => chain,
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

const { submitBonusPrediction } = await import("./actions");

const CAT_ID = "11111111-1111-4111-8111-111111111111";
const SLOT_A = "22222222-2222-4222-8222-222222222222";
const SLOT_B = "33333333-3333-4333-8333-333333333333";
const PAST = "2000-01-01T00:00:00.000Z";
const FUTURE = "2999-01-01T00:00:00.000Z";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

function picksField(picks: { slotId: string; pickLabel: string }[]) {
  return JSON.stringify(picks);
}

beforeEach(() => {
  fromQueue.length = 0;
  calls.length = 0;
  authUser.current = null;
});

describe("submitBonusPrediction", () => {
  it("rejects malformed picks JSON", async () => {
    const result = await submitBonusPrediction(
      { status: "idle" },
      formData({ categoryId: CAT_ID, picks: "not-json" }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
    expect(calls).toHaveLength(0);
  });

  it("rejects an unauthenticated caller", async () => {
    const result = await submitBonusPrediction(
      { status: "idle" },
      formData({
        categoryId: CAT_ID,
        picks: picksField([{ slotId: SLOT_A, pickLabel: "Player X" }]),
      }),
    );
    expect(result).toEqual({ status: "error", code: "unauthenticated" });
  });

  it("rejects a submission after the category's locks_at has passed", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({
      data: {
        id: CAT_ID,
        tournament_id: "t1",
        locks_at: PAST,
        duplicate_stacking_allowed: true,
      },
      error: null,
    });

    const result = await submitBonusPrediction(
      { status: "idle" },
      formData({
        categoryId: CAT_ID,
        picks: picksField([{ slotId: SLOT_A, pickLabel: "Player X" }]),
      }),
    );
    expect(result).toEqual({ status: "error", code: "locked" });
    expect(calls).toHaveLength(0);
  });

  it("rejects a caller who isn't a participant in the category's tournament", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({
      data: {
        id: CAT_ID,
        tournament_id: "t1",
        locks_at: FUTURE,
        duplicate_stacking_allowed: true,
      },
      error: null,
    });
    fromQueue.push({ data: null, error: null }); // participant lookup — no row

    const result = await submitBonusPrediction(
      { status: "idle" },
      formData({
        categoryId: CAT_ID,
        picks: picksField([{ slotId: SLOT_A, pickLabel: "Player X" }]),
      }),
    );
    expect(result).toEqual({ status: "error", code: "not_a_member" });
  });

  it("rejects a pick for a slot that doesn't belong to the category", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({
      data: {
        id: CAT_ID,
        tournament_id: "t1",
        locks_at: FUTURE,
        duplicate_stacking_allowed: true,
      },
      error: null,
    });
    fromQueue.push({ data: { id: "p1" }, error: null }); // participant found
    fromQueue.push({ data: [{ id: SLOT_A }], error: null }); // only SLOT_A is real

    const result = await submitBonusPrediction(
      { status: "idle" },
      formData({
        categoryId: CAT_ID,
        picks: picksField([{ slotId: SLOT_B, pickLabel: "Player X" }]),
      }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
    expect(calls).toHaveLength(0);
  });

  it("rejects duplicate picks across slots when the category disallows stacking (SCORING-RULES.md §6)", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({
      data: {
        id: CAT_ID,
        tournament_id: "t1",
        locks_at: FUTURE,
        duplicate_stacking_allowed: false,
      },
      error: null,
    });
    fromQueue.push({ data: { id: "p1" }, error: null }); // participant found
    fromQueue.push({ data: [{ id: SLOT_A }, { id: SLOT_B }], error: null }); // slots

    const result = await submitBonusPrediction(
      { status: "idle" },
      formData({
        categoryId: CAT_ID,
        picks: picksField([
          { slotId: SLOT_A, pickLabel: "Player X" },
          { slotId: SLOT_B, pickLabel: "player x" }, // same label, different case
        ]),
      }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
    expect(calls).toHaveLength(0);
  });

  it("upserts every slot pick together and returns success", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({
      data: {
        id: CAT_ID,
        tournament_id: "t1",
        locks_at: FUTURE,
        duplicate_stacking_allowed: true,
      },
      error: null,
    });
    fromQueue.push({ data: { id: "p1" }, error: null }); // participant found
    fromQueue.push({ data: [{ id: SLOT_A }, { id: SLOT_B }], error: null }); // slots
    fromQueue.push({ data: null, error: null }); // upsert succeeds

    const result = await submitBonusPrediction(
      { status: "idle" },
      formData({
        categoryId: CAT_ID,
        picks: picksField([
          { slotId: SLOT_A, pickLabel: "Player X" },
          { slotId: SLOT_B, pickLabel: "Player X" }, // stacking allowed — same pick twice
        ]),
      }),
    );

    expect(result).toEqual({ status: "success", categoryId: CAT_ID });
    expect(calls).toEqual([
      {
        table: "bonus_predictions",
        op: "upsert",
        payload: [
          {
            category_id: CAT_ID,
            slot_id: SLOT_A,
            participant_id: "p1",
            pick_label: "Player X",
          },
          {
            category_id: CAT_ID,
            slot_id: SLOT_B,
            participant_id: "p1",
            pick_label: "Player X",
          },
        ],
      },
    ]);
  });
});
