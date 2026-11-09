import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tournaments } from "./identity";
import { matches } from "./competition";
import type { LiveAccess, LiveObservation, LiveChange } from "@/lib/live/types";
export const liveRuntime = pgTable("live_runtime", {
  provider: text("provider").primaryKey(),
  access: text("access").$type<LiveAccess>().notNull().default("delayed"),
  enabledAt: timestamp("enabled_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastPollAt: timestamp("last_poll_at", { withTimezone: true }),
  pollingUntil: timestamp("polling_until", { withTimezone: true }),
  lastError: text("last_error"),
});
export const liveMatchState = pgTable("live_match_state", {
  matchId: uuid("match_id")
    .primaryKey()
    .references(() => matches.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull().default(0),
  observation: jsonb("observation").$type<LiveObservation>().notNull(),
});
export const liveMatchEvents = pgTable(
  "live_match_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    eventKey: text("event_key").notNull(),
    change: jsonb("change").$type<LiveChange>().notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("live_match_event_once").on(t.matchId, t.eventKey)],
);
