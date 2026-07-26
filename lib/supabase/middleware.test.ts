/**
 * Regression coverage for the fail-closed error handling added to
 * `updateSession` (Phase 9 #73 — offline/error state pass). Before this
 * fix, an unhandled rejection from `supabase.auth.getUser()` (a Supabase
 * outage, DNS failure, etc.) would propagate uncaught through
 * `updateSession` into `proxy.ts`, which runs on essentially every request
 * site-wide — a single Supabase auth blip would 500 the whole app. Mocks
 * `@supabase/ssr`'s `createServerClient` since `updateSession` constructs
 * its own client internally rather than accepting one as a parameter.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: getUserMock },
  }),
}));

vi.mock("@/lib/env/public", () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  },
}));

import { updateSession } from "./middleware";

function fakeRequest() {
  return new NextRequest("https://example.com/predictions");
}

describe("updateSession", () => {
  it("returns the user on a normal getUser() response", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const { user } = await updateSession(fakeRequest());
    expect(user).toEqual({ id: "u1" });
  });

  it("returns null (not thrown) when getUser() resolves with no user", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    const { user } = await updateSession(fakeRequest());
    expect(user).toBeNull();
  });

  it("fails closed to null instead of throwing when getUser() rejects", async () => {
    getUserMock.mockRejectedValueOnce(new Error("network unreachable"));
    const { user } = await updateSession(fakeRequest());
    expect(user).toBeNull();
  });
});
