import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { FriendPrediction } from "./reveal";

/** Use the caller's session for both lock checks and prediction reads. RLS is
 * the final boundary, including the manager and retrospective onboarding. */
export async function readFriendsPredictions(
  client: Awaited<ReturnType<typeof createClient>>,
  matchId: string,
  tournamentId: string,
): Promise<FriendPrediction[] | null> {
  const { data: locked, error } = await client.rpc("is_match_locked", {
    p_match_id: matchId,
  });
  if (error || locked !== true) return null;
  const [picks, members] = await Promise.all([
    client
      .from("match_predictions")
      .select(
        "participant_id,predicted_home,predicted_away,points_earned,is_default",
      )
      .eq("match_id", matchId),
    client
      .from("participants")
      .select("id,display_name")
      .eq("tournament_id", tournamentId),
  ]);
  if (picks.error || members.error)
    throw new Error("לא ניתן לטעון את ניחושי החברים כרגע. נסו לרענן.");
  const confirmed = await client.rpc("is_match_locked", {
    p_match_id: matchId,
  });
  if (confirmed.error || confirmed.data !== true) return null;
  const byId = new Map((picks.data ?? []).map((p) => [p.participant_id, p]));
  return (members.data ?? []).map((member) => {
    const p = byId.get(member.id);
    return {
      id: member.id,
      name: member.display_name,
      home: p?.predicted_home ?? null,
      away: p?.predicted_away ?? null,
      points: p?.points_earned ?? null,
      isDefault: p?.is_default ?? false,
    };
  });
}
