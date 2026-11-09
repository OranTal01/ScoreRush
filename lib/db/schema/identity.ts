import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import {
  invitationStatusEnum,
  participantRoleEnum,
  tournamentStatusEnum,
} from "./enums";

/** Platform account — one row per Supabase Auth identity (DATABASE.md §2 "users"). */
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  /** Platform Owner / Super Admin, PRODUCT.md §5 — MVP: exactly one (Oran), DECISIONS.md tournament-creation resolution. */
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A single competition instance (DATABASE.md §2 "tournaments"). */
export const tournaments = pgTable("tournaments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** e.g. "world_cup" | "euro" | "champions_league" | "custom" — free text, see ARCHITECTURE.md §6. */
  competition: text("competition").notNull(),
  status: tournamentStatusEnum("status").notNull().default("upcoming"),
  settingsRevision: integer("settings_revision").notNull().default(0),
  matchLockMinutes: integer("match_lock_minutes").notNull().default(5),
  onboardingOpen: boolean("onboarding_open").notNull().default(false),
  onboardingMatchday: integer("onboarding_matchday").notNull().default(1),
  onboardingClosesAt: timestamp("onboarding_closes_at", { withTimezone: true }),
  onboardingClosedAt: timestamp("onboarding_closed_at", { withTimezone: true }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Membership of a user in a tournament — role + tournament-scoped display profile (DATABASE.md §2, §4). */
export const participants = pgTable(
  "participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: participantRoleEnum("role").notNull().default("participant"),
    displayName: text("display_name").notNull(),
    avatarInitials: text("avatar_initials"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("participants_tournament_user_unique").on(
      table.tournamentId,
      table.userId,
    ),
  ],
);

/** Single-use, expirable tokens granting join access to a tournament (DATABASE.md §2). */
export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  maxUses: integer("max_uses").notNull().default(1),
  useCount: integer("use_count").notNull().default(0),
  /** Optional — binds the invitation to one email address only. */
  boundEmail: text("bound_email"),
  status: invitationStatusEnum("status").notNull().default("pending"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  consumedBy: uuid("consumed_by").references(() => users.id),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
