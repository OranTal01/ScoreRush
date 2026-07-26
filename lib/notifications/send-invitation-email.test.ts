/**
 * Mocks `@/lib/db/client` and `./resend` rather than hitting a real database
 * or the real Resend API — same rationale as lib/sync/upsert-matches.test.ts
 * and lib/sync/diagnostics.test.ts (both carry `import "server-only"`/rely
 * on live infra). The behavior under test is orchestration: which branch
 * (`sent` vs `failed`) runs, what gets written to `notifications`, and that
 * nothing here ever throws — not the actual SQL or HTTP calls, which
 * upsert-matches.test.ts's doc comment notes were smoke-tested against real
 * infra separately.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectQueue, insertValuesCalls, sendMock } = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertValuesCalls: [] as unknown[],
  sendMock: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectQueue.shift() ?? []),
        }),
      }),
    }),
    insert: () => ({
      values: (v: unknown) => {
        insertValuesCalls.push(v);
        return Promise.resolve(undefined);
      },
    }),
  },
}));

vi.mock("./resend", () => ({
  resendAdapter: { providerName: "resend", send: sendMock },
}));

const { sendInvitationEmail } = await import("./send-invitation-email");

const TOURNAMENT_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  selectQueue.length = 0;
  insertValuesCalls.length = 0;
  sendMock.mockReset();
});

describe("sendInvitationEmail", () => {
  it("sends the email and logs a 'sent' notification on success", async () => {
    selectQueue.push([{ name: "מונדיאל המשרד" }]);
    sendMock.mockResolvedValue({ providerMessageId: "msg_1" });

    const status = await sendInvitationEmail({
      tournamentId: TOURNAMENT_ID,
      boundEmail: "invitee@example.com",
      joinUrl: "https://scorerush.app/join/abc",
    });

    expect(status).toBe("sent");
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [message] = sendMock.mock.calls[0];
    expect(message.subject).toContain("מונדיאל המשרד");

    expect(insertValuesCalls).toHaveLength(1);
    expect(insertValuesCalls[0]).toMatchObject({
      tournamentId: TOURNAMENT_ID,
      recipientEmail: "invitee@example.com",
      type: "invitation",
      channel: "email",
      status: "sent",
      providerMessageId: "msg_1",
    });
  });

  it("logs a 'failed' notification with the error detail and returns 'failed' when Resend throws", async () => {
    selectQueue.push([{ name: "מונדיאל המשרד" }]);
    sendMock.mockRejectedValue(new Error("RESEND_API_KEY is not set"));

    const status = await sendInvitationEmail({
      tournamentId: TOURNAMENT_ID,
      boundEmail: "invitee@example.com",
      joinUrl: "https://scorerush.app/join/abc",
    });

    expect(status).toBe("failed");
    expect(insertValuesCalls).toHaveLength(1);
    expect(insertValuesCalls[0]).toMatchObject({
      status: "failed",
      errorDetail: "RESEND_API_KEY is not set",
      sentAt: null,
    });
  });

  it("falls back to a blank tournament name when no tournament row is found, without blocking the send", async () => {
    // selectQueue left empty -> the mocked .limit() resolves [], same shape
    // a real "tournament somehow missing" result would have.
    sendMock.mockResolvedValue({ providerMessageId: "msg_2" });

    const status = await sendInvitationEmail({
      tournamentId: TOURNAMENT_ID,
      boundEmail: "invitee@example.com",
      joinUrl: "https://scorerush.app/join/xyz",
    });

    expect(status).toBe("sent");
    const [message] = sendMock.mock.calls[0];
    expect(message.subject).toContain('""');
  });
});
