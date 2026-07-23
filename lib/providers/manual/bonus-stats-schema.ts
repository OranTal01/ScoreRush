/**
 * Shape of one admin-entered bonus-stat category, submitted through the
 * admin UI (Phase 7) — mirrors schema.ts's match-input shape: manual is a
 * first-class adapter, not a special case (ARCHITECTURE.md §6). A category
 * carries its own `statKey` because a manual submission can define any
 * number of categories at once (unlike football-data.org, which only ever
 * yields "top_scorer"/"top_assists" from one /scorers call).
 */
import { z } from "zod";

export const manualBonusStatEntryInputSchema = z.object({
  /** Set only if the admin is linking this entry to a provider's player/team id; usually null for a fully manual category. */
  refId: z.string().nullable().optional(),
  label: z.string().min(1),
  value: z.number(),
});

export const manualBonusStatInputSchema = z.object({
  /** Admin-assigned identifier (e.g. "top_scorer") — matched to a tournament's `bonus_categories` at the admin-UI layer, never guessed here (types.ts). */
  statKey: z.string().min(1),
  entries: z.array(z.unknown()),
});

export type ManualBonusStatEntryInput = z.infer<
  typeof manualBonusStatEntryInputSchema
>;
export type ManualBonusStatInput = z.infer<typeof manualBonusStatInputSchema>;
