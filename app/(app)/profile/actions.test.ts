import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  writes: [] as unknown[],
  filters: [] as unknown[],
  members: [{ id: "p2", display_name: "Liron" }],
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tournaments/current", () => ({
  getCurrentParticipant: async () => ({
    participantId: "p1",
    tournamentId: "t1",
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mock.user } }) },
    from: () => {
      let write = false;
      const chain = {
        select: () => chain,
        eq: (key: string, value: string) => {
          mock.filters.push([key, value]);
          return chain;
        },
        update: (value: unknown) => {
          write = true;
          mock.writes.push(value);
          return chain;
        },
        maybeSingle: async () => ({ data: { id: "p1" }, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: write ? { id: "p1" } : mock.members,
            error: null,
          }).then(resolve),
      };
      return chain;
    },
  }),
}));
import { saveNickname } from "./actions";
function form(name: string) {
  const data = new FormData();
  data.set("nickname", name);
  data.set("role", "tournament_admin");
  return data;
}
beforeEach(() => {
  mock.user = { id: "u1" };
  mock.writes.length = 0;
  mock.filters.length = 0;
});
describe("nickname update", () => {
  it("requires authentication", async () => {
    mock.user = null;
    expect((await saveNickname({}, form("Oran"))).error).toBeTruthy();
    expect(mock.writes).toHaveLength(0);
  });
  it("rejects a nickname used by another participant", async () => {
    expect((await saveNickname({}, form(" liron "))).error).toBeTruthy();
    expect(mock.writes).toHaveLength(0);
  });
  it("writes only the current participant name and initials", async () => {
    expect(await saveNickname({}, form("אורן טל"))).toEqual({
      savedName: "אורן טל",
    });
    expect(mock.writes).toEqual([
      { display_name: "אורן טל", avatar_initials: "אט" },
    ]);
    expect(mock.filters).toContainEqual(["id", "p1"]);
    expect(mock.filters).toContainEqual(["user_id", "u1"]);
  });
});
