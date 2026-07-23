import { pgSchema, uuid } from "drizzle-orm/pg-core";

/**
 * Reference-only declaration of Supabase's built-in `auth.users` table.
 *
 * Drizzle never generates DDL for this (Supabase owns and migrates the
 * `auth` schema itself) — it exists purely so our own tables can declare a
 * real foreign key against Supabase Auth's identity table instead of a
 * loose, unenforced uuid column. See ARCHITECTURE.md §4.
 */
export const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});
