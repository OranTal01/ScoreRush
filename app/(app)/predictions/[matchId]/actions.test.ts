/**
 * Unit coverage for `submitMatchPrediction`'s orchestration branches (Phase 5
 * exit criteria, ROADMAP.md: "predictions submitted, locked, and scored
 * correctly end-to-end" — this covers the "submitted"/"locked" half; scoring
 * itself is covered by lib/scoring/*.test.ts and recompute.test.ts). Mocks
 * `@/lib/supabase/server` rather than hitting a real database or a real
 * auth session — same rationale as lib/sync/upsert-matches.test.ts and
 * lib/scoring/recompute.test.ts: this is orchestration logic (auth check,
 * lock-time pre-check, insert-then-fallback-to-update) independent of the
 * actual SQL/RLS, and `lib/supabase/server.ts` carries `import "server-only"`
 * plus reads real request cookies, neither of which exist outside a Next.js
 * request. The real lock-time backstop (RLS) is exercised against the live
 * database separately, not here (see this file's doc comment in actions.ts).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { fromQueue, calls, authUser, continuation } = vi.hoisted(() => ({
  continuation: vi.fn(),
  fromQueue: [] as { data: unknown; error: unknown }[],
  calls: [] as { table: string; op: string; payload: unknown }[],
  authUser: { current: null as { id: string } | null },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/predictions/read-continuation", () => ({
  readPredictionContinuation: continuation,
}));

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
        insert: (payload: unknown) => typeof chain;
        update: (payload: unknown) => typeof chain;
      } = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => promise,
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),
        insert: (payload: unknown) => {
          calls.push({ table, op: "insert", payload });
          return chain;
        },
        update: (payload: unknown) => {
          calls.push({ table, op: "update", payload });
          return chain;
        },
      };
      return chain;
    },
  }),
}));

const { submitMatchPrediction } = await import("./actions");

const MATCH_ID = "11111111-1111-4111-8111-111111111111";
const PAST = "2000-01-01T00:00:00.000Z";
const FUTURE = "2999-01-01T00:00:00.000Z";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  fromQueue.length = 0;
  calls.length = 0;
  authUser.current = null;
  continuation.mockReset();
});

describe("submitMatchPrediction", () => {
  it.each([false, true])(
    "keeps an acknowledged save when next-game lookup fails: %s",
    async (fail) => {
      authUser.current = { id: "u1" };
      const match = {
        id: MATCH_ID,
        tournament_id: "t1",
        lock_time: FUTURE,
        status: "scheduled",
        stage: "league_stage",
        matchday: 2,
      };
      fromQueue.push(
        { data: match, error: null },
        { data: { id: "p1" }, error: null },
        { data: null, error: null },
      );
      const next = {
        nextMatchId: "22222222-2222-4222-8222-222222222222",
        remaining: 2,
      };
      if (fail) continuation.mockRejectedValue(new Error("Timeout"));
      else continuation.mockResolvedValue(next);
      const result = await submitMatchPrediction(
        { status: "idle" },
        formData({
          matchId: MATCH_ID,
          predictedHome: "0",
          predictedAway: "0",
          advance: "1",
        }),
      );
      expect(result).toEqual({
        status: "success",
        predictedHome: 0,
        predictedAway: 0,
        ...(fail ? {} : { continuation: next }),
      });
      expect(continuation).toHaveBeenCalledWith(expect.anything(), match, "p1");
      expect(calls).toHaveLength(1);
    },
  );
  it("rejects malformed input before touching the database", async () => {
    const result = await submitMatchPrediction(
      { status: "idle" },
      formData({
        matchId: "not-a-uuid",
        predictedHome: "1",
        predictedAway: "0",
      }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
    expect(calls).toHaveLength(0);
  });

  it("rejects an unauthenticated caller", async () => {
    const result = await submitMatchPrediction(
      { status: "idle" },
      formData({ matchId: MATCH_ID, predictedHome: "1", predictedAway: "0" }),
    );
    expect(result).toEqual({ status: "error", code: "unauthenticated" });
  });

  it("rejects a submission after the match's lock_time has passed", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({
      data: { id: MATCH_ID, tournament_id: "t1", lock_time: PAST },
      error: null,
    });

    const result = await submitMatchPrediction(
      { status: "idle" },
      formData({ matchId: MATCH_ID, predictedHome: "1", predictedAway: "0" }),
    );
    expect(result).toEqual({ status: "error", code: "locked" });
    expect(calls).toHaveLength(0);
  });

  it("rejects a caller who isn't a participant in the match's tournament", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({
      data: {
        id: MATCH_ID,
        tournament_id: "t1",
        lock_time: FUTURE,
        status: "scheduled",
      },
      error: null,
    });
    fromQueue.push({ data: null, error: null }); // participants lookup — no row

    const result = await submitMatchPrediction(
      { status: "idle" },
      formData({ matchId: MATCH_ID, predictedHome: "1", predictedAway: "0" }),
    );
    expect(result).toEqual({ status: "error", code: "not_a_member" });
  });

  it("inserts a new prediction and returns success", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({
      data: {
        id: MATCH_ID,
        tournament_id: "t1",
        lock_time: FUTURE,
        status: "scheduled",
      },
      error: null,
    });
    fromQueue.push({ data: { id: "p1" }, error: null }); // participant found
    fromQueue.push({ data: null, error: null }); // insert succeeds

    const result = await submitMatchPrediction(
      { status: "idle" },
      formData({ matchId: MATCH_ID, predictedHome: "2", predictedAway: "1" }),
    );

    expect(result).toEqual({
      status: "success",
      predictedHome: 2,
      predictedAway: 1,
    });
    expect(calls).toEqual([
      {
        table: "match_predictions",
        op: "insert",
        payload: {
          match_id: MATCH_ID,
          participant_id: "p1",
          predicted_home: 2,
          predicted_away: 1,
        },
      },
    ]);
  });

  it("falls back to updating the existing row on a unique-violation (editing a prediction)", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({
      data: {
        id: MATCH_ID,
        tournament_id: "t1",
        lock_time: FUTURE,
        status: "scheduled",
      },
      error: null,
    });
    fromQueue.push({ data: { id: "p1" }, error: null }); // participant found
    fromQueue.push({ data: null, error: { code: "23505" } }); // insert: unique violation
    fromQueue.push({ data: [{ match_id: MATCH_ID }], error: null }); // update succeeds

    const result = await submitMatchPrediction(
      { status: "idle" },
      formData({ matchId: MATCH_ID, predictedHome: "0", predictedAway: "0" }),
    );

    expect(result).toEqual({
      status: "success",
      predictedHome: 0,
      predictedAway: 0,
    });
    expect(calls[0]).toEqual({
      table: "match_predictions",
      op: "insert",
      payload: {
        match_id: MATCH_ID,
        participant_id: "p1",
        predicted_home: 0,
        predicted_away: 0,
      },
    });
    expect(calls[1].table).toBe("match_predictions");
    expect(calls[1].op).toBe("update");
    expect(calls[1].payload).toMatchObject({
      predicted_home: 0,
      predicted_away: 0,
    });
  });
  it("rejects blanks rather than silently turning them into a zero draw", async () => {
    expect(
      await submitMatchPrediction(
        { status: "idle" },
        formData({ matchId: MATCH_ID, predictedHome: "", predictedAway: "" }),
      ),
    ).toEqual({ status: "error", code: "invalid_input" });
    expect(calls).toHaveLength(0);
  });
  it("does not report success if a concurrent lock makes an update affect zero rows", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push(
      {
        data: {
          id: MATCH_ID,
          tournament_id: "t1",
          lock_time: FUTURE,
          status: "scheduled",
        },
        error: null,
      },
      { data: { id: "p1" }, error: null },
      { data: null, error: { code: "23505" } },
      { data: [], error: null },
    );
    expect(
      await submitMatchPrediction(
        { status: "idle" },
        formData({ matchId: MATCH_ID, predictedHome: "2", predictedAway: "1" }),
      ),
    ).toEqual({ status: "error", code: "locked" });
  });
});
