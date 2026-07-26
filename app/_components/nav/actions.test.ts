/**
 * Coverage for `switchTournament` (task #80). Mocks `@/lib/supabase/server`
 * the same way app/(app)/groups/actions.test.ts does (this action builds
 * its own client, rather than accepting one as a parameter), plus
 * `next/headers`/`next/cache`/`next/navigation` since the action reads
 * request cookies, writes one, revalidates, and redirects.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { fromQueue, authUser, cookieSets, redirectMock, revalidateMock } =
  vi.hoisted(() => ({
    fromQueue: [] as { data: unknown; error: unknown }[],
    authUser: { current: null as { id: string } | null },
    cookieSets: [] as { name: string; value: string; options: unknown }[],
    redirectMock: vi.fn(),
    revalidateMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, options: unknown) => {
      cookieSets.push({ name, value, options });
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: authUser.current } }),
    },
    from: () => {
      const response = fromQueue.shift() ?? { data: null, error: null };
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

const { switchTournament } = await import("./actions");

const T1 = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  fromQueue.length = 0;
  cookieSets.length = 0;
  authUser.current = null;
  redirectMock.mockClear();
  revalidateMock.mockClear();
});

describe("switchTournament", () => {
  it("does nothing for an unauthenticated caller", async () => {
    await switchTournament(T1);
    expect(cookieSets).toHaveLength(0);
    expect(redirectMock).not.toHaveBeenCalled();
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it("does nothing when the caller isn't a participant of the target tournament", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({ data: null, error: null }); // membership check — no row

    await switchTournament(T1);
    expect(cookieSets).toHaveLength(0);
    expect(redirectMock).not.toHaveBeenCalled();
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it("sets the cookie, revalidates, and redirects for a real member", async () => {
    authUser.current = { id: "u1" };
    fromQueue.push({ data: { id: "p1" }, error: null }); // membership check — hit

    await switchTournament(T1);

    expect(cookieSets).toHaveLength(1);
    expect(cookieSets[0].name).toBe("active_tournament_id");
    expect(cookieSets[0].value).toBe(T1);
    expect(revalidateMock).toHaveBeenCalledWith("/", "layout");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
