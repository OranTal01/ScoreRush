import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resendAdapter, ResendApiError } from "./resend";

const MESSAGE = {
  to: "invitee@example.com",
  subject: "הזמנה לטורניר",
  html: "<p>הוזמנת</p>",
  text: "הוזמנת",
};

describe("resendAdapter.send", () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFromEmail = process.env.RESEND_FROM_EMAIL;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.RESEND_API_KEY = originalApiKey;
    process.env.RESEND_FROM_EMAIL = originalFromEmail;
  });

  it("throws a clear config error when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_FROM_EMAIL = "tournaments@example.com";

    await expect(resendAdapter.send(MESSAGE)).rejects.toThrow(
      /RESEND_API_KEY is not set/,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws a clear config error when RESEND_FROM_EMAIL is unset", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.RESEND_FROM_EMAIL;

    await expect(resendAdapter.send(MESSAGE)).rejects.toThrow(
      /RESEND_FROM_EMAIL is not set/,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the message and returns the provider message id on success", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "tournaments@example.com";
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: "msg_123" }), { status: 200 }),
    );

    const result = await resendAdapter.send(MESSAGE);

    expect(result).toEqual({ providerMessageId: "msg_123" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key",
        }),
      }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({
      from: "tournaments@example.com",
      to: MESSAGE.to,
      subject: MESSAGE.subject,
      html: MESSAGE.html,
      text: MESSAGE.text,
    });
  });

  it("throws with the parsed error message on a non-2xx response", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "tournaments@example.com";
    vi.mocked(fetch).mockImplementation(
      async () =>
        new Response(JSON.stringify({ message: "invalid `to` field" }), {
          status: 422,
        }),
    );

    await expect(resendAdapter.send(MESSAGE)).rejects.toThrow(
      ResendApiError,
    );
    await expect(resendAdapter.send(MESSAGE)).rejects.toThrow(
      /HTTP 422: invalid `to` field/,
    );
  });

  it("throws a generic HTTP error when the failure response has no parseable body", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "tournaments@example.com";
    vi.mocked(fetch).mockResolvedValue(new Response("not json", { status: 500 }));

    await expect(resendAdapter.send(MESSAGE)).rejects.toThrow(/HTTP 500/);
  });
});
