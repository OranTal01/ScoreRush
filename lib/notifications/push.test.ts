import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  duplicate: false,
  remove: vi.fn(),
  statuses: [] as string[],
}));
vi.mock("web-push", () => ({ default: { sendNotification: mocks.send } }));
vi.mock("@/lib/db/client", () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => (mocks.duplicate ? [] : [{ id: "claim" }]),
        }),
      }),
    }),
    update: () => ({
      set: (s: { status: string }) => {
        mocks.statuses.push(s.status);
        return { where: async () => {} };
      },
    }),
    delete: () => ({ where: mocks.remove }),
  },
}));
import { deliverPush, validPushEndpoint } from "./push";
const sub = {
  id: "sub",
  userId: "user",
  endpoint: "https://fcm.googleapis.com/fcm/send/example",
  p256dh: "key",
  auth: "auth",
  preferences: {
    reminders: true,
    summaries: true,
    kickoff: false,
    finished: false,
  },
  createdAt: new Date(),
};
beforeEach(() => {
  mocks.duplicate = false;
  mocks.send.mockReset();
  mocks.remove.mockReset();
  mocks.statuses.length = 0;
  vi.stubEnv("VAPID_PUBLIC_KEY", "public");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private");
});
describe("push delivery", () => {
  it("rejects internal and lookalike destinations", () => {
    expect(validPushEndpoint("https://127.0.0.1/push")).toBe(false);
    expect(validPushEndpoint("https://fcm.googleapis.com.evil.test/push")).toBe(
      false,
    );
    expect(validPushEndpoint("https://fcm.googleapis.com/push")).toBe(true);
  });
  it("does not send an event already claimed", async () => {
    mocks.duplicate = true;
    expect(
      await deliverPush(sub, "event", {
        title: "a",
        body: "b",
        url: "/",
        tag: "tag",
      }),
    ).toBe("duplicate");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("removes an expired subscription without retrying", async () => {
    mocks.send.mockRejectedValue({ statusCode: 410 });
    expect(
      await deliverPush(sub, "event", {
        title: "a",
        body: "b",
        url: "/",
        tag: "tag",
      }),
    ).toBe("failed");
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledOnce();
  });
  it("expires live event notifications quickly instead of delivering stale goals", async () => {
    mocks.send.mockResolvedValue({});
    expect(
      await deliverPush(sub, "live:event", {
        title: "goal",
        body: "temporary",
        url: "/live",
        tag: "live:match",
      }),
    ).toBe("sent");
    expect(mocks.send).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ TTL: 120 }),
    );
  });
});
