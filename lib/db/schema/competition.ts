import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { matchStatusEnum, normalizationStatusEnum } from "./enums";
import { tournaments } from "./identity";

/** A `{home, away}` score pair — regular/extra-time/penalty/live results all share this shape. */
export type MatchScore = { home: number; away: number };

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  flagAssetUrl: text("flag_asset_url"),
  /** Nullable — knockout-only custom tournaments may have no groups. */
  group: text("group"),
  seed: integer("seed"),
  /** External provider's team id (e.g. football-data.org numeric team id, stringified) — null for manually-entered teams (ARCHITECTURE.md §6). */
  providerId: text("provider_id"),
});

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  /** External provider's match id — null for manually-entered matches (ARCHITECTURE.md §6). */
  providerId: text("provider_id"),
  /** e.g. "group" | "round_of_16" | "semifinal" | "final" | custom — free text, see ARCHITECTURE.md §6. */
  stage: text("stage").notNull(),
  group: text("group"),
  matchday: integer("matchday"),
  homeTeamId: uuid("home_team_id")
    .notNull()
    .references(() => teams.id),
  awayTeamId: uuid("away_team_id")
    .notNull()
    .references(() => teams.id),
  kickoff: timestamp("kickoff", { withTimezone: true }).notNull(),
  /** Predictions close here (DATABASE.md §5 prediction-visibility policy keys off this). */
  lockTime: timestamp("lock_time", { withTimezone: true }).notNull(),
  status: matchStatusEnum("status").notNull().default("scheduled"),

  /** Canonical 90-minute + stoppage result — the ONLY input to prediction scoring (SCORING-RULES.md §3). */
  regularResult: jsonb("regular_result").$type<MatchScore>(),
  /** Present only for knockout matches that went past 90 minutes; never used for prediction scoring. */
  extraTimeResult: jsonb("extra_time_result").$type<MatchScore>(),
  /** Never counted for prediction scoring OR tournament statistics (SCORING-RULES.md §3-4). */
  penaltyResult: jsonb("penalty_result").$type<MatchScore>(),
  /** In-progress score while `status = 'live'`; null otherwise. */
  liveScore: jsonb("live_score").$type<MatchScore>(),
  /** "home" | "away" | "draw" | null while undecided. */
  winner: text("winner"),

  /** Raw, as-received provider payload — immutable, timestamped (ARCHITECTURE.md §5). */
  rawProviderPayload: jsonb("raw_provider_payload"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  normalizationStatus: normalizationStatusEnum("normalization_status")
    .notNull()
    .default("pending"),
  /** e.g. "team order reversed vs. expected" (DATABASE.md §3). */
  warningFlag: text("warning_flag"),
});
