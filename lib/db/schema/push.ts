import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";
import { users, tournaments } from "./identity";
export type PushPreferences = {
  reminders: boolean;
  summaries: boolean;
  kickoff: boolean;
  finished: boolean;
  goals?: boolean;
  redCards?: boolean;
};
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    preferences: jsonb("preferences").$type<PushPreferences>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("push_user_endpoint").on(t.userId, t.endpoint)],
);
export type DigestStanding = {
  id: string;
  name: string;
  rank: number;
  total: number;
  gained: number;
  exact: number;
};
export const tournamentDigests = pgTable(
  "tournament_digests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    baseline: jsonb("baseline").$type<DigestStanding[]>(),
    standings: jsonb("standings").$type<DigestStanding[]>(),
    body: text("body"),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("digest_tournament_day").on(t.tournamentId, t.day)],
);
export const pushDeliveries = pgTable(
  "push_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => pushSubscriptions.id, { onDelete: "cascade" }),
    eventKey: text("event_key").notNull(),
    status: text("status").notNull().default("sending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("push_delivery_once").on(t.subscriptionId, t.eventKey)],
);
export const notificationRuntime = pgTable("notification_runtime", {
  id: text("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  enabledAt: timestamp("enabled_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
});
