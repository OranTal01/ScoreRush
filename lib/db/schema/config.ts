import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { bonusResolvesAtEnum } from "./enums";
import { tournaments } from "./identity";

/**
 * Versioned per-tournament point values (DATABASE.md §6). Never mutated in
 * place once matches have been scored against a version — for MVP the whole
 * configuration is additionally locked at tournament creation and never
 * edited at all (DECISIONS.md "Rule editability mid-tournament"), so
 * `version` exists for the schema's sake but Phase 3 only ever writes v1.
 */
export const scoringRules = pgTable("scoring_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  exactScorePoints: integer("exact_score_points").notNull().default(9),
  winnerAndDiffPoints: integer("winner_and_diff_points").notNull().default(6),
  winnerOnlyPoints: integer("winner_only_points").notNull().default(3),
  wrongPoints: integer("wrong_points").notNull().default(0),
  groupRankingPointsPerPosition: integer("group_ranking_points_per_position")
    .notNull()
    .default(3),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bonusCategories = pgTable("bonus_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** "player" | "team" | custom — free text, see DATABASE.md §2. */
  type: text("type").notNull(),
  resolvesAt: bonusResolvesAtEnum("resolves_at").notNull().default("ongoing"),
  duplicateStackingAllowed: boolean("duplicate_stacking_allowed")
    .notNull()
    .default(true),
  /**
   * When picks for this category stop being editable and become visible to
   * other participants — the bonus-prediction analogue of `matches.lock_time`,
   * needed so the "hidden until lock, no admin bypass" rule (DATABASE.md §5)
   * has something concrete to key off for bonus_predictions. Null means the
   * category never locks (picks stay self-only-visible indefinitely).
   */
  locksAt: timestamp("locks_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const bonusSlots = pgTable("bonus_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => bonusCategories.id, { onDelete: "cascade" }),
  slotIndex: integer("slot_index").notNull(),
  points: integer("points").notNull(),
});

export const prizes = pgTable("prizes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull(),
  /** Free-text description — never a monetary transaction (SCORING-RULES.md §8). */
  description: text("description").notNull(),
});

/** Which data-provider adapter(s) a tournament is bound to (ARCHITECTURE.md §6). */
export const tournamentProviders = pgTable("tournament_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  /** e.g. "football_data_org" | "manual". */
  matchDataProvider: text("match_data_provider").notNull().default("manual"),
  matchDataConfig: jsonb("match_data_config"),
  bonusStatsProvider: text("bonus_stats_provider").notNull().default("manual"),
  bonusStatsConfig: jsonb("bonus_stats_config"),
});
