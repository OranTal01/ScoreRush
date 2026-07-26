/**
 * Coverage for `getUserTournaments` (task #80), which backs the tournament
 * switcher's real tournament list. Fake Supabase client follows the same
 * synchronous-queue style as lib/auth/admin.test.ts, extended with `.in()`/
 * `.returns()` passthroughs for the array-returning queries this function
 * makes (no `.maybeSingle()` here, unlike getCurrentParticipant).
 */
import { describe, expect, it } from "vitest";
import { getUserTournaments } from "./list";

function fakeSupabase(queue: { data: unknown }[]) {
  return {
    from: () => {
      const response = queue.shift() ?? { data: null };
      const promise = Promise.resolve(response);
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        returns: () => chain,
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),
      };
      return chain;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("getUserTournaments", () => {
  it("returns an empty list for a caller with no participant rows", async () => {
    const supabase = fakeSupabase([{ data: [] }]);
    const result = await getUserTournaments(supabase, "u1", null);
    expect(result).toEqual([]);
  });

  it("returns an empty list when participant rows resolve to null", async () => {
    const supabase = fakeSupabase([{ data: null }]);
    const result = await getUserTournaments(supabase, "u1", null);
    expect(result).toEqual([]);
  });

  it("marks the current tournament and sorts it first", async () => {
    const supabase = fakeSupabase([
      { data: [{ tournament_id: "t1" }, { tournament_id: "t2" }] },
      {
        data: [
          { id: "t1", name: "Tournament One", competition: "comp-1" },
          { id: "t2", name: "Tournament Two", competition: "comp-2" },
        ],
      },
    ]);
    const result = await getUserTournaments(supabase, "u1", "t2");
    expect(result).toEqual([
      {
        id: "t2",
        name: "Tournament Two",
        competition: "comp-2",
        isCurrent: true,
      },
      {
        id: "t1",
        name: "Tournament One",
        competition: "comp-1",
        isCurrent: false,
      },
    ]);
  });

  it("marks nothing current when currentTournamentId is null", async () => {
    const supabase = fakeSupabase([
      { data: [{ tournament_id: "t1" }] },
      { data: [{ id: "t1", name: "Tournament One", competition: "comp-1" }] },
    ]);
    const result = await getUserTournaments(supabase, "u1", null);
    expect(result).toEqual([
      {
        id: "t1",
        name: "Tournament One",
        competition: "comp-1",
        isCurrent: false,
      },
    ]);
  });

  it("filters out a participant row whose tournament no longer resolves", async () => {
    const supabase = fakeSupabase([
      { data: [{ tournament_id: "t1" }, { tournament_id: "orphan" }] },
      { data: [{ id: "t1", name: "Tournament One", competition: "comp-1" }] },
    ]);
    const result = await getUserTournaments(supabase, "u1", null);
    expect(result).toEqual([
      {
        id: "t1",
        name: "Tournament One",
        competition: "comp-1",
        isCurrent: false,
      },
    ]);
  });
});
