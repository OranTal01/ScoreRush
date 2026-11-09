import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tournaments } from "./identity";
import type { RoundStanding } from "@/lib/history/rounds";
export const roundHistory = pgTable(
  "round_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    roundKey: text("round_key").notNull(),
    label: text("label").notNull(),
    trackedOpen: boolean("tracked_open").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    standings: jsonb("standings").$type<RoundStanding[]>(),
  },
  (t) => [
    uniqueIndex("round_history_tournament_round").on(
      t.tournamentId,
      t.roundKey,
    ),
  ],
);
