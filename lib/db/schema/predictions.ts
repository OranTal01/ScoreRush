import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { matches } from "./competition";
import { bonusCategories, bonusSlots } from "./config";
import { predictionOutcomeEnum } from "./enums";
import { participants, tournaments } from "./identity";

/** A participant's score prediction for one match (DATABASE.md §2). */
export const matchPredictions = pgTable(
  "match_predictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    predictedHome: integer("predicted_home").notNull(),
    predictedAway: integer("predicted_away").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    pointsEarned: integer("points_earned"),
    outcome: predictionOutcomeEnum("outcome"),
  },
  (table) => [
    uniqueIndex("match_predictions_match_participant_unique").on(
      table.matchId,
      table.participantId,
    ),
  ],
);

/** A participant's predicted final group standings, submitted before the group stage starts. */
export const groupPredictions = pgTable(
  "group_predictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    group: text("group").notNull(),
    /** Team ids, predicted finishing order. */
    predictedOrder: jsonb("predicted_order").$type<string[]>().notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    pointsEarned: integer("points_earned"),
    /** Group ranking points post only after the whole group stage is complete (SCORING-RULES.md §5). */
    finalized: boolean("finalized").notNull().default(false),
  },
  (table) => [
    uniqueIndex("group_predictions_tournament_participant_group_unique").on(
      table.tournamentId,
      table.participantId,
      table.group,
    ),
  ],
);

/** A participant's pick for one bonus-category slot. Duplicate picks across slots are allowed by default (SCORING-RULES.md §6). */
export const bonusPredictions = pgTable(
  "bonus_predictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => bonusCategories.id, { onDelete: "cascade" }),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => bonusSlots.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    pickLabel: text("pick_label").notNull(),
    /** Optional external/provider id for the picked player/team. */
    pickRefId: text("pick_ref_id"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    pointsEarned: integer("points_earned"),
  },
  (table) => [
    uniqueIndex("bonus_predictions_slot_participant_unique").on(
      table.slotId,
      table.participantId,
    ),
  ],
);

/**
 * The single resolved stats/winners snapshot for a bonus category — reused
 * identically across bonus breakdown, points, and leaderboard (SCORING-RULES.md §6:
 * "never independently fetched per surface").
 */
export const bonusStats = pgTable("bonus_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => bonusCategories.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  /** Provider/player/team id this stat belongs to, if applicable. */
  refId: text("ref_id"),
  value: integer("value").notNull(),
  /** Ties must display equal rank — determined by max numeric value, not list position (SCORING-RULES.md §6). */
  rank: integer("rank").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Provider name or "manual" (manual-entry fallback, ARCHITECTURE.md §6). */
  source: text("source").notNull().default("manual"),
});

/** Periodic/event-triggered capture of full standings, enabling rank-movement history without recomputing from scratch. */
export const leaderboardSnapshots = pgTable("leaderboard_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  participantId: uuid("participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull(),
  /** Must always equal matchPoints + groupRankingPoints + bonusPoints (SCORING-RULES.md §9). */
  totalPoints: integer("total_points").notNull(),
  matchPoints: integer("match_points").notNull(),
  groupRankingPoints: integer("group_ranking_points").notNull(),
  bonusPoints: integer("bonus_points").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
