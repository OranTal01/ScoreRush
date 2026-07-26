/**
 * Builds the invitation email's Resend-ready `NotificationMessage`
 * (ARCHITECTURE.md §8, ROADMAP.md Phase 8 task #67) — the platform's first
 * real email trigger, per the user's explicit Phase 8 scope decision
 * (invitation email only for this first pass, not match-lock reminders).
 *
 * Kept as a pure function, separate from
 * lib/notifications/send-invitation-email.ts's I/O (DB read for the
 * tournament name, resendAdapter.send, the notifications row write) — same
 * separation the scoring engine (lib/scoring/*.ts) and the provider
 * normalization layer (lib/providers/*\/adapter.ts) already use: pure
 * shape/copy logic is trivial to unit test without mocking fetch or the DB.
 */
import { invitationEmail as content } from "@/lib/content/he";
import type { NotificationMessage } from "./types";

/**
 * `tournamentName` is admin-entered free text (app/(app)/admin/tournaments/new,
 * Phase 7 task #58) — escape before interpolating into HTML, since it ends
 * up in a real email sent to a third party's inbox. `joinUrl` is built from
 * our own origin + a random token (never user input), so it doesn't
 * strictly need escaping, but is escaped too for defense in depth.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildInvitationEmail(params: {
  to: string;
  tournamentName: string;
  joinUrl: string;
}): NotificationMessage {
  const { to, tournamentName, joinUrl } = params;
  const safeName = escapeHtml(tournamentName);
  const safeUrl = escapeHtml(joinUrl);

  return {
    to,
    subject: content.subject(tournamentName),
    html: content.bodyHtml(safeName, safeUrl),
    text: content.bodyText(tournamentName, joinUrl),
  };
}
