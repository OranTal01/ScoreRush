import { z } from "zod";
import { rankingConfigSchema } from "@/lib/scoring/ranking-config";

const points = z.number().int().min(0).max(999);
const deadline = z.union([z.iso.datetime(), z.null()]);
export const statKeys = [
  "champion",
  "runner_up",
  "top_scoring_team",
  "league_winner",
  "top_scorer",
  "top_assists",
  "manual",
] as const;
export const settingsSchema = z
  .object({
    tournamentId: z.uuid(),
    revision: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(120),
    matchLockMinutes: z.number().int().min(0).max(1440),
    exactScorePoints: points,
    winnerAndDiffPoints: points,
    winnerOnlyPoints: points,
    wrongPoints: points,
    groupRankingPointsPerPosition: points,
    rankingConfig: rankingConfigSchema,
    rankingLocksAt: deadline,
    onboardingOpen: z.boolean(),
    onboardingMatchday: z.number().int().min(1).max(50),
    categories: z
      .array(
        z.object({
          id: z.uuid().optional(),
          name: z.string().trim().min(1).max(100),
          type: z.enum(["team", "player"]),
          statKey: z.enum(statKeys),
          resolvesAt: z.enum(["ongoing", "tournament_end"]),
          duplicateStackingAllowed: z.boolean(),
          locksAt: deadline,
          slots: z
            .array(z.object({ id: z.uuid().optional(), points }))
            .min(1)
            .max(20),
        }),
      )
      .max(20),
    prizes: z.array(z.string().trim().min(1).max(200)).max(50),
  })
  .superRefine((data, ctx) => {
    const ids = data.categories
      .flatMap((c) => [c.id, ...c.slots.map((s) => s.id)])
      .filter(Boolean);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "מזהה קטגוריה או אפשרות כפול" });
    for (const [i, c] of data.categories.entries()) {
      if (
        c.statKey !== "manual" &&
        (["top_scorer", "top_assists"].includes(c.statKey)
          ? c.type !== "player"
          : c.type !== "team")
      )
        ctx.addIssue({
          code: "custom",
          path: ["categories", i, "type"],
          message: "סוג הבחירה אינו מתאים לבונוס",
        });
    }
  });
export type TournamentSettings = z.infer<typeof settingsSchema>;
export type SettingsView = {
  settings: TournamentSettings;
  onboardingClosed: boolean;
  canDelete: boolean;
  counts: {
    participants: number;
    matches: number;
    predictions: number;
    rankings: number;
    bonusPicks: Record<string, number>;
  };
};
export type SettingsResult = {
  error?: string;
  saved?: boolean;
  deleted?: boolean;
};

// A datetime-local field deliberately represents Israel time, independent of
// the administrator's phone timezone. Reject nonexistent DST wall times.
export function israelDateInput(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function israelInputToIso(value: string): string | null {
  if (!value) return null;
  const utc = Date.parse(`${value}Z`);
  if (!Number.isFinite(utc)) throw new Error("תאריך לא תקין");
  for (const offset of [2, 3]) {
    const iso = new Date(utc - offset * 3600000).toISOString();
    if (israelDateInput(iso) === value) return iso;
  }
  throw new Error("השעה אינה קיימת בעת המעבר לשעון קיץ. בחרו שעה אחרת.");
}
