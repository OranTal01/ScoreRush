import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  notificationChannelEnum,
  notificationStatusEnum,
  syncOutcomeEnum,
} from "./enums";
import { tournaments, users } from "./identity";

/**
 * Every scoring-relevant change (rule edit, recalculation, override) with
 * before/after values (DATABASE.md §2, §7). This is a trust requirement —
 * disputes about scoring must be resolvable by looking at logs, not memory
 * (ARCHITECTURE.md §10).
 */
export const scoreAuditLogs = pgTable("score_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  /** e.g. "match_prediction" | "scoring_rules" | "match". */
  entity: text("entity").notNull(),
  entityId: uuid("entity_id").notNull(),
  field: text("field").notNull(),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  reason: text("reason").notNull(),
  actingUserId: uuid("acting_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Manual interventions: reason, evidence reference, admin id, timestamp, reversible flag (DATABASE.md §7). */
export const adminOverrides = pgTable("admin_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  /** Link/note pointing at the real provider response that justified the override. */
  evidenceRef: text("evidence_ref"),
  enteredBy: uuid("entered_by")
    .notNull()
    .references(() => users.id),
  reversible: boolean("reversible").notNull().default(true),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Provider sync attempts: outcome, duration, error detail (DATABASE.md §2). */
export const syncLogs = pgTable("sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  outcome: syncOutcomeEnum("outcome").notNull(),
  durationMs: integer("duration_ms").notNull(),
  errorDetail: text("error_detail"),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** General operational event log, e.g. tournament state transitions, invitation consumed (DATABASE.md §2). */
export const systemEvents = pgTable("system_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id, {
    onDelete: "cascade",
  }),
  type: text("type").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Outbound notification records (future, Phase 8), delivery status (DATABASE.md §2). */
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tournamentId: uuid("tournament_id").references(() => tournaments.id, {
    onDelete: "cascade",
  }),
  channel: notificationChannelEnum("channel").notNull().default("email"),
  status: notificationStatusEnum("status").notNull().default("pending"),
  subject: text("subject"),
  body: text("body"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
