import "server-only";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
const optionsSchema = z.array(
  z.object({
    refId: z.string(),
    label: z.string(),
    team: z.string().optional(),
  }),
);
export async function getBonusOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tournamentId: string,
  type: string,
) {
  if (type === "team") {
    const { data, error } = await supabase
      .from("teams")
      .select("id, provider_id, name")
      .eq("tournament_id", tournamentId)
      .order("name");
    if (error) throw new Error("Cannot load team choices");
    return (data ?? []).map((team) => ({
      refId: team.provider_id ?? team.id,
      label: team.name,
      team: undefined as string | undefined,
    }));
  }
  if (type === "player") {
    const { data, error } = await supabase
      .from("tournament_providers")
      .select("bonus_stats_config")
      .eq("tournament_id", tournamentId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Cannot load player choices");
    return optionsSchema.parse(data?.bonus_stats_config?.playerOptions ?? []);
  }
  return [];
}
