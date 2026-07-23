/**
 * Postgres enums for genuinely fixed, closed sets (DATABASE.md §2-3).
 *
 * Fields that describe open-ended/tournament-specific concepts (match stage,
 * group label, bonus category type, provider name) are intentionally plain
 * `text`, not enums — ARCHITECTURE.md/PRODUCT.md require supporting arbitrary
 * competitions and custom tournaments without a code change, so those values
 * must stay data, not a schema migration.
 */
import { pgEnum } from "drizzle-orm/pg-core";

export const participantRoleEnum = pgEnum("participant_role", [
  "tournament_admin",
  "participant",
]);

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "upcoming",
  "active",
  "finished",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "live",
  "finished",
  "postponed",
  "cancelled",
]);

/** Mirrors lib/mock/types.ts PredictionOutcome — keep in sync. */
export const predictionOutcomeEnum = pgEnum("prediction_outcome", [
  "exact",
  "winner_diff",
  "winner",
  "draw_correct",
  "wrong",
]);

/** SCORING-RULES.md §7 — terminal categories (champion/runner-up-style). */
export const bonusResolvesAtEnum = pgEnum("bonus_resolves_at", [
  "ongoing",
  "tournament_end",
]);

export const syncOutcomeEnum = pgEnum("sync_outcome", ["success", "error"]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "consumed",
  "expired",
  "revoked",
]);

export const normalizationStatusEnum = pgEnum("normalization_status", [
  "pending",
  "normalized",
  "flagged",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "push",
  "whatsapp",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
]);
