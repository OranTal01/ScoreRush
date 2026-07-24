/**
 * Shared notification-adapter contract (ARCHITECTURE.md §8, ROADMAP.md Phase
 * 8) — mirrors lib/providers/types.ts's `MatchDataAdapter`/`BonusStatsAdapter`
 * pattern: every real sender (Resend now; push/WhatsApp later per
 * ARCHITECTURE.md's planned order) implements the same `NotificationAdapter`
 * interface, so callers (e.g. the invite action, task #67) never branch on
 * which concrete provider is configured.
 *
 * Unlike the match-data adapters, `send()` isn't given a `config` argument —
 * there's exactly one active sender per environment today (read from
 * `process.env` at call time, same lazy-read convention as
 * lib/providers/football-data/client.ts's `FOOTBALL_DATA_API_TOKEN`), not a
 * per-tournament choice like `tournament_data_provider`.
 */

export interface NotificationMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback — not every mail client renders HTML. */
  text: string;
}

export interface NotificationSendResult {
  /** The provider's own id for the sent message, for support/debugging (stored in `notifications.providerMessageId`). */
  providerMessageId: string;
}

/**
 * Every real sender implements this. `send` throws on any failure (missing
 * config, network error, non-2xx response) — same throw-on-failure contract
 * as `fetchFootballDataMatches` — so the caller decides fallback policy
 * (ARCHITECTURE.md §5's pattern, applied here to notifications: an email
 * failure must never block the underlying action, e.g. invitation creation,
 * task #67) rather than the adapter silently swallowing it.
 */
export interface NotificationAdapter {
  /** Matches `notifications.channel`'s conceptual provider — e.g. "resend". */
  readonly providerName: string;
  send(message: NotificationMessage): Promise<NotificationSendResult>;
}
