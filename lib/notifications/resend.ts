/**
 * Resend adapter (ARCHITECTURE.md §8, ROADMAP.md Phase 8) — the platform's
 * first real notification channel. Talks to Resend's REST API directly via
 * `fetch`, same style as lib/providers/football-data/client.ts (no SDK
 * dependency), and the same lazy env-read + throw-on-missing-config pattern
 * as that module's `getToken()`.
 *
 * Server-only — RESEND_API_KEY must never reach the browser.
 */
import "server-only";
import type { NotificationAdapter, NotificationMessage, NotificationSendResult } from "./types";

const RESEND_API_URL = "https://api.resend.com/emails";

export class ResendApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ResendApiError";
    this.status = status;
  }
}

function getConfig(): { apiKey: string; fromEmail: string } {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new ResendApiError(
      "RESEND_API_KEY is not set — see .env.local.example. Only flows that send a real email (e.g. inviting a participant by email) need it.",
    );
  }
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    throw new ResendApiError(
      "RESEND_FROM_EMAIL is not set — see .env.local.example.",
    );
  }
  return { apiKey, fromEmail };
}

interface ResendSuccessResponse {
  id: string;
}

interface ResendErrorResponse {
  message?: string;
}

export const resendAdapter: NotificationAdapter = {
  providerName: "resend",

  async send(message: NotificationMessage): Promise<NotificationSendResult> {
    const { apiKey, fromEmail } = getConfig();

    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!res.ok) {
      const body: ResendErrorResponse = await res.json().catch(() => ({}));
      throw new ResendApiError(
        `Resend returned HTTP ${res.status}${body.message ? `: ${body.message}` : ""}`,
        res.status,
      );
    }

    const data: ResendSuccessResponse = await res.json();
    return { providerMessageId: data.id };
  },
};
