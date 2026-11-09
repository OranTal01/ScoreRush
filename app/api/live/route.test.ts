// @vitest-environment node
import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  current: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.user } }),
}));
vi.mock("@/lib/tournaments/current", () => ({
  getCurrentParticipant: mocks.current,
}));
vi.mock("@/lib/live/read", () => ({ readLiveView: mocks.read }));
import { GET } from "./route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "u" } } });
  mocks.current.mockResolvedValue({
    tournamentId: "cup",
    participantId: "self",
  });
  mocks.read.mockResolvedValue({ tournamentId: "cup", standings: [] });
});
it("requires both a signed-in user and tournament membership", async () => {
  mocks.user.mockResolvedValue({ data: { user: null } });
  expect((await GET()).status).toBe(401);
  expect(mocks.current).not.toHaveBeenCalled();
  mocks.user.mockResolvedValue({ data: { user: { id: "u" } } });
  mocks.current.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect(mocks.read).not.toHaveBeenCalled();
});
it("returns private uncached data only for the current membership", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.read).toHaveBeenCalledWith(expect.anything(), {
    tournamentId: "cup",
    participantId: "self",
  });
});
it("handles session and data timeouts without returning private diagnostics", async () => {
  mocks.user.mockRejectedValue(new Error("secret diagnostic"));
  let response = await GET();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret");
  mocks.user.mockResolvedValue({ data: { user: { id: "u" } } });
  mocks.read.mockRejectedValue(new Error("secret diagnostic"));
  response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
