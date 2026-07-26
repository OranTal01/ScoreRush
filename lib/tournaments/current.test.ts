/**
 * Coverage for the cookie-aware resolution added to `getCurrentParticipant`
 * (task #80). Mocks `next/headers` since `current.ts` now reads the
 * switcher's persisted cookie directly — without this mock, `cookies()`
 * throws ("called outside a request scope") in a plain Vitest environment.
 * Fake Supabase client follows the same synchronous-queue style as
 * lib/auth/admin.test.ts.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { cookieValue } = vi.hoisted(() => ({
  cookieValue: { current: undefined as string | undefined },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "active_tournament_id" && cookieValue.current
        ? { name, value: cookieValue.current }
        : undefined,
  }),
}));

const { getCurrentParticipant } = await import("./current");

function fakeSupabase(queue: { data: unknown }[]) {
  return {
    from: () => {
      const response = queue.shift() ?? { data: null };
      const promise = Promise.resolve(response);
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: () => promise,
      };
      return chain;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  cookieValue.current = undefined;
});

describe("getCurrentParticipant", () => {
  it("falls back to most-recently-joined when there's no cookie", async () => {
    const supabase = fakeSupabase([
      { data: { id: "p1", tournament_id: "t1" } },
    ]);
    const result = await getCurrentParticipant(supabase, "u1");
    expect(result).toEqual({ participantId: "p1", tournamentId: "t1" });
  });

  it("returns null when the caller has no participant rows at all", async () => {
    const supabase = fakeSupabase([{ data: null }]);
    const result = await getCurrentParticipant(supabase, "u1");
    expect(result).toBeNull();
  });

  it("uses the cookie's tournament when the caller is still a member of it", async () => {
    cookieValue.current = "t2";
    const supabase = fakeSupabase([
      { data: { id: "p2", tournament_id: "t2" } }, // cookie lookup hits
    ]);
    const result = await getCurrentParticipant(supabase, "u1");
    expect(result).toEqual({ participantId: "p2", tournamentId: "t2" });
  });

  it("falls back to most-recently-joined when the cookie names a tournament the caller isn't a member of", async () => {
    cookieValue.current = "stale-tournament";
    const supabase = fakeSupabase([
      { data: null }, // cookie lookup — no matching participant row
      { data: { id: "p1", tournament_id: "t1" } }, // fallback
    ]);
    const result = await getCurrentParticipant(supabase, "u1");
    expect(result).toEqual({ participantId: "p1", tournamentId: "t1" });
  });
});
