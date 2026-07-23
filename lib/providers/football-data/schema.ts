/**
 * Raw football-data.org API v4 response shapes — validated with zod
 * (ARCHITECTURE.md §5 "Validation: shape/sanity checks; reject or flag,
 * never guess"). Only the fields ScoreRush actually consumes; field names
 * are FD's own, matching the public API docs and the shape already proven
 * working by the legacy world-cup-bets project's football-data client.
 */
import { z } from "zod";

const scorePairSchema = z.object({
  home: z.number().int().nullable(),
  away: z.number().int().nullable(),
});

const teamRefSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  /** Occasionally missing/empty on FD's side for lesser-known teams — falls back to `name` at normalize time. */
  shortName: z.string().nullable().optional(),
});

export const fdMatchStatusValues = [
  "SCHEDULED",
  "TIMED",
  "IN_PLAY",
  "PAUSED",
  "FINISHED",
  "SUSPENDED",
  "POSTPONED",
  "CANCELLED",
  "AWARDED",
] as const;

const matchScoreSchema = z.object({
  winner: z.enum(["HOME_TEAM", "AWAY_TEAM", "DRAW"]).nullable(),
  duration: z.enum(["REGULAR", "EXTRA_TIME", "PENALTY_SHOOTOUT"]),
  fullTime: scorePairSchema,
  halfTime: scorePairSchema,
  /** Only present when duration !== "REGULAR". */
  regularTime: scorePairSchema.optional(),
  extraTime: scorePairSchema.optional(),
  penalties: scorePairSchema.optional(),
});

export const fdMatchSchema = z.object({
  id: z.number(),
  utcDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "utcDate must be a parseable ISO 8601 timestamp",
  }),
  status: z.enum(fdMatchStatusValues),
  stage: z.string().min(1),
  group: z.string().nullable().optional(),
  matchday: z.number().int().nullable().optional(),
  homeTeam: teamRefSchema,
  awayTeam: teamRefSchema,
  score: matchScoreSchema,
});

export const fdMatchesResponseSchema = z.object({
  matches: z.array(z.unknown()),
});

export type FDMatch = z.infer<typeof fdMatchSchema>;
export type FDMatchStatus = (typeof fdMatchStatusValues)[number];
export type FDMatchesResponse = z.infer<typeof fdMatchesResponseSchema>;
