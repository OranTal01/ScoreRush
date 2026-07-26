/**
 * Mocks `@/lib/db/client` rather than hitting a real database — same
 * rationale as lib/audit/log.ts's and lib/sync/diagnostics.ts's own tests:
 * this is pure shape/mapping logic (ISO-string conversion, null-narrowing)
 * independent of the actual SQL, and `lib/db/client.ts` carries
 * `import "server-only"`.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { queue } = vi.hoisted(() => ({ queue: [] as unknown[][] }));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => {
      const chain: {
        from: () => typeof chain;
        where: () => typeof chain;
        orderBy: () => typeof chain;
        limit: () => Promise<unknown[]>;
      } = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => Promise.resolve(queue.shift() ?? []),
      };
      return chain;
    },
  },
}));

const { getNotificationLog } = await import("./list");

beforeEach(() => {
  queue.length = 0;
});

describe("getNotificationLog", () => {
  it("maps a sent row, converting timestamps to ISO strings", async () => {
    const sentAt = new Date("2026-01-01T12:00:00.000Z");
    const createdAt = new Date("2026-01-01T11:59:00.000Z");
    queue.push([
      {
        id: "n1",
        recipientEmail: "invitee@example.com",
        type: "invitation",
        channel: "email",
        status: "sent",
        sentAt,
        errorDetail: null,
        createdAt,
      },
    ]);

    const entries = await getNotificationLog("t1");

    expect(entries).toEqual([
      {
        id: "n1",
        recipientEmail: "invitee@example.com",
        type: "invitation",
        channel: "email",
        status: "sent",
        sentAt: sentAt.toISOString(),
        errorDetail: null,
        createdAt: createdAt.toISOString(),
      },
    ]);
  });

  it("maps a failed row with a null sentAt and a populated errorDetail", async () => {
    const createdAt = new Date("2026-01-02T09:00:00.000Z");
    queue.push([
      {
        id: "n2",
        recipientEmail: "invitee2@example.com",
        type: "invitation",
        channel: "email",
        status: "failed",
        sentAt: null,
        errorDetail: "RESEND_API_KEY is not set",
        createdAt,
      },
    ]);

    const [entry] = await getNotificationLog("t1");

    expect(entry.status).toBe("failed");
    expect(entry.sentAt).toBeNull();
    expect(entry.errorDetail).toBe("RESEND_API_KEY is not set");
  });

  it("returns an empty array when the tournament has no notifications", async () => {
    const entries = await getNotificationLog("t-empty");
    expect(entries).toEqual([]);
  });
});
