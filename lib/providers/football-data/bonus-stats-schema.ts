/**
 * Raw football-data.org API v4 `/scorers` response shapes — validated with
 * zod, mirroring schema.ts's match-shape validation (ARCHITECTURE.md §5).
 * One endpoint covers both goals and assists (DECISIONS.md §3a), so there's
 * no separate "assists" shape — normalize.ts derives two stat lists from
 * this same parsed entry.
 */
import { z } from "zod";

const fdScorerPlayerSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
});

const fdScorerTeamSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  shortName: z.string().nullable().optional(),
});

export const fdScorerSchema = z.object({
  player: fdScorerPlayerSchema,
  team: fdScorerTeamSchema,
  playedMatches: z.number().int().nullable().optional(),
  goals: z.number().int().nullable().optional(),
  /** Sometimes null on FD's side (DECISIONS.md §3a) — normalize.ts treats that as 0, never errors. */
  assists: z.number().int().nullable().optional(),
  penalties: z.number().int().nullable().optional(),
});

export const fdScorersResponseSchema = z.object({
  scorers: z.array(z.unknown()),
});

export type FDScorer = z.infer<typeof fdScorerSchema>;
export type FDScorersResponse = z.infer<typeof fdScorersResponseSchema>;
