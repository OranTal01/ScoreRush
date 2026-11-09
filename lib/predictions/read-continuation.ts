import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { nextPrediction, type ContinuationMatch } from "./continuation";
export async function readPredictionContinuation(
  client: Awaited<ReturnType<typeof createClient>>,
  current: Pick<
    ContinuationMatch,
    "id" | "tournament_id" | "stage" | "matchday"
  >,
  participantId: string,
) {
  let query = client
    .from("matches")
    .select(
      "id,tournament_id,stage,matchday,kickoff,lock_time,status,tournaments(onboarding_open,onboarding_matchday,onboarding_closes_at)",
    )
    .eq("tournament_id", current.tournament_id)
    .eq("stage", current.stage);
  query =
    current.matchday === null
      ? query.is("matchday", null)
      : query.eq("matchday", current.matchday);
  const [games, picks] = await Promise.all([
    query.returns<ContinuationMatch[]>(),
    client
      .from("match_predictions")
      .select("match_id,is_default")
      .eq("participant_id", participantId),
  ]);
  if (games.error || picks.error || !games.data || !picks.data)
    throw new Error("Next prediction unavailable");
  return nextPrediction(current, games.data, picks.data, Date.now());
}
