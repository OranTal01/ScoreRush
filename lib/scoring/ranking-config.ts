import { z } from "zod";

export const rankingConfigSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("exact") }),
  z.object({
    mode: z.literal("bands"),
    sizes: z.array(z.number().int().positive().max(128)).min(2).max(16),
  }),
]);
export type RankingConfig = z.infer<typeof rankingConfigSchema>;
export const EXACT_RANKING: RankingConfig = { mode: "exact" };
export const CHAMPIONS_LEAGUE_RANKING: RankingConfig = {
  mode: "bands",
  sizes: [8, 16, 12],
};

// Missing legacy configuration means exact positions. Invalid saved rules
// must stop scoring instead of silently falling back to a different game.
export function parseRankingConfig(value: unknown): RankingConfig {
  return value == null ? EXACT_RANKING : rankingConfigSchema.parse(value);
}

export function rankingBands(config: RankingConfig) {
  if (config.mode !== "bands") return [];
  let start = 0;
  return config.sizes.map((size, index) => {
    const band = {
      index,
      start,
      end: start + size,
      size,
      label: `${start + 1}–${start + size}`,
    };
    start += size;
    return band;
  });
}
