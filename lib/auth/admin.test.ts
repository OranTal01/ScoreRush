/**
 * Unit coverage for the admin-guard helpers (ROADMAP.md Phase 7 task #57).
 * Builds a fake Supabase client matching the shape `getAdminContext`/
 * `isPlatformAdmin` actually call — no `vi.mock` needed since `admin.ts`
 * only imports `createClient`'s *type*, never the module itself, at
 * runtime. Follows the same synchronous-queue mock chain style as
 * app/(app)/groups/actions.test.ts: `.from(table)` shifts the next queued
 * response immediately (not lazily inside `.maybeSingle()`), so the two
 * `Promise.all`'d queries in `getAdminContext` resolve deterministically in
 * the exact order they're written in source — `.from()` for both runs
 * synchronously before either promise settles.
 */
import { describe, expect, it } from "vitest";
import { getAdminContext, isPlatformAdmin } from "./admin";

function fakeSupabase(queue: { data: unknown }[]) {
  return {
    from: () => {
      const response = queue.shift() ?? { data: null };
      const promise = Promise.resolve(response);
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => promise,
      };
      return chain;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("getAdminContext", () => {
  it("is admin when the user is a platform admin, even with no tournament_admin row", async () => {
    const supabase = fakeSupabase([
      { data: { is_platform_admin: true } }, // users
      { data: null }, // participants — not a tournament_admin row
    ]);
    const result = await getAdminContext(supabase, "u1", "t1");
    expect(result).toEqual({
      isPlatformAdmin: true,
      isTournamentAdmin: false,
      isAdmin: true,
    });
  });

  it("is admin when the user is a tournament_admin, even without platform admin", async () => {
    const supabase = fakeSupabase([
      { data: { is_platform_admin: false } }, // users
      { data: { role: "tournament_admin" } }, // participants
    ]);
    const result = await getAdminContext(supabase, "u1", "t1");
    expect(result).toEqual({
      isPlatformAdmin: false,
      isTournamentAdmin: true,
      isAdmin: true,
    });
  });

  it("is not admin for a plain participant", async () => {
    const supabase = fakeSupabase([
      { data: { is_platform_admin: false } }, // users
      { data: { role: "participant" } }, // participants
    ]);
    const result = await getAdminContext(supabase, "u1", "t1");
    expect(result).toEqual({
      isPlatformAdmin: false,
      isTournamentAdmin: false,
      isAdmin: false,
    });
  });

  it("defaults to not-admin when neither row exists", async () => {
    const supabase = fakeSupabase([{ data: null }, { data: null }]);
    const result = await getAdminContext(supabase, "u1", "t1");
    expect(result).toEqual({
      isPlatformAdmin: false,
      isTournamentAdmin: false,
      isAdmin: false,
    });
  });
});

describe("isPlatformAdmin", () => {
  it("returns true for a platform admin", async () => {
    const supabase = fakeSupabase([{ data: { is_platform_admin: true } }]);
    expect(await isPlatformAdmin(supabase, "u1")).toBe(true);
  });

  it("returns false when there's no users row", async () => {
    const supabase = fakeSupabase([{ data: null }]);
    expect(await isPlatformAdmin(supabase, "u1")).toBe(false);
  });
});
