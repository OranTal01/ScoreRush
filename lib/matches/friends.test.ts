import { describe, it, expect, vi } from "vitest";
import { readFriendsPredictions } from "./friends";
import { canRevealPredictions } from "./reveal";
const time = "2026-09-08T19:00:00Z",
  now = Date.parse(time);
describe("friend prediction visibility", () => {
  it("never reveals while editing, during onboarding or after postponement", () => {
    expect(canRevealPredictions("scheduled", time, false, now - 1)).toBe(false);
    expect(canRevealPredictions("finished", time, true, now)).toBe(false);
    expect(canRevealPredictions("postponed", time, false, now)).toBe(false);
    expect(canRevealPredictions("cancelled", time, false, now)).toBe(false);
    expect(canRevealPredictions("finished", "invalid", false, now)).toBe(false);
    expect(canRevealPredictions("scheduled", time, false, now)).toBe(true);
  });
  it("does not even query other predictions before the server confirms lock", async () => {
    for (const result of [
      { data: false, error: null },
      { data: null, error: { message: "offline" } },
    ]) {
      const client = { rpc: vi.fn().mockResolvedValue(result), from: vi.fn() };
      expect(
        await readFriendsPredictions(client as never, "match", "cup"),
      ).toBeNull();
      expect(client.from).not.toHaveBeenCalled();
    }
  });
  it("discards reads when onboarding is reopened during the request", async () => {
    const client = {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: true })
        .mockResolvedValueOnce({ data: false }),
      from: vi
        .fn()
        .mockReturnValue({
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
    };
    expect(
      await readFriendsPredictions(client as never, "match", "cup"),
    ).toBeNull();
  });
});
