import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: null as null | { id: string },
  admin: false,
  owner: false,
  write: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, delete: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));
vi.mock("@/lib/tournaments/current", () => ({
  ACTIVE_TOURNAMENT_COOKIE: "active_tournament_id",
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  }),
}));
vi.mock("@/lib/auth/admin", () => ({
  getAdminContext: async () => ({
    isAdmin: mocks.admin,
    isPlatformAdmin: mocks.owner,
  }),
}));
vi.mock("@/lib/tournaments/settings-store", () => ({
  writeTournamentSettings: mocks.write,
  removeTournament: mocks.remove,
  SettingsError: class extends Error {},
}));
import { deleteTournament, saveSettings } from "./actions";
const valid = {
  tournamentId: "11111111-1111-4111-8111-111111111111",
  revision: 0,
  name: "Test",
  matchLockMinutes: 5,
  exactScorePoints: 9,
  winnerAndDiffPoints: 6,
  winnerOnlyPoints: 3,
  wrongPoints: 0,
  groupRankingPointsPerPosition: 3,
  rankingConfig: { mode: "exact" },
  rankingLocksAt: null,
  onboardingOpen: false,
  onboardingMatchday: 1,
  categories: [],
  prizes: [],
};
function form() {
  const f = new FormData();
  f.set("settings", JSON.stringify(valid));
  f.set("reason", "כללים שסיכמנו");
  f.set("confirm", "on");
  f.set("tournamentId", valid.tournamentId);
  f.set("name", "Test");
  f.set("confirmDelete", "on");
  return f;
}
beforeEach(() => {
  mocks.user = null;
  mocks.admin = false;
  mocks.owner = false;
  vi.clearAllMocks();
});
describe("settings action access boundaries", () => {
  it("rejects unauthenticated and ordinary users without writing", async () => {
    expect((await saveSettings({}, form())).error).toBeTruthy();
    mocks.user = { id: "member" };
    expect((await saveSettings({}, form())).error).toBeTruthy();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("requires confirmation and a reason even for administrators", async () => {
    mocks.user = { id: "admin" };
    mocks.admin = true;
    const f = form();
    f.delete("confirm");
    expect((await saveSettings({}, f)).error).toBeTruthy();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("passes authenticated identity and validated data to the transaction", async () => {
    mocks.user = { id: "admin" };
    mocks.admin = true;
    expect(await saveSettings({}, form())).toEqual({ saved: true });
    expect(mocks.write).toHaveBeenCalledWith(valid, "admin", "כללים שסיכמנו");
  });
  it("tournament administrators cannot delete tournaments", async () => {
    mocks.user = { id: "admin" };
    mocks.admin = true;
    expect((await deleteTournament({}, form())).error).toBeTruthy();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("platform owner deletion still requires explicit confirmation", async () => {
    mocks.user = { id: "owner" };
    mocks.owner = true;
    const f = form();
    f.delete("confirmDelete");
    expect((await deleteTournament({}, f)).error).toBeTruthy();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
