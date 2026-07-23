/**
 * Shape of one admin-entered match, submitted through the admin UI (Phase
 * 7) and normalized through the exact same validation/normalization path
 * as any live provider (ARCHITECTURE.md §6 — manual is a first-class
 * adapter, not a special case).
 */
import { z } from "zod";
import { matchStatusEnum } from "@/lib/db/schema/enums";

const matchScoreSchema = z.object({
  home: z.number().int().nonnegative(),
  away: z.number().int().nonnegative(),
});

const manualTeamInputSchema = z.object({
  /** Set only if the admin is linking this team to a provider's team id for future auto-sync; usually null. */
  providerId: z.string().nullable().optional(),
  name: z.string().min(1),
  shortName: z.string().min(1),
});

export const manualMatchInputSchema = z.object({
  stage: z.string().min(1),
  group: z.string().nullable().optional(),
  matchday: z.number().int().nullable().optional(),
  homeTeam: manualTeamInputSchema,
  awayTeam: manualTeamInputSchema,
  kickoff: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "kickoff must be a parseable ISO 8601 timestamp",
  }),
  status: z.enum(matchStatusEnum.enumValues),
  regularResult: matchScoreSchema.nullable().optional(),
  extraTimeResult: matchScoreSchema.nullable().optional(),
  penaltyResult: matchScoreSchema.nullable().optional(),
  liveScore: matchScoreSchema.nullable().optional(),
  /** Almost always left unset — derived from the scores instead (see normalize.ts). */
  winner: z.enum(["home", "away", "draw"]).nullable().optional(),
});

export type ManualMatchInput = z.infer<typeof manualMatchInputSchema>;
