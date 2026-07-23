import "server-only";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type CurrentParticipant = {
  participantId: string;
  tournamentId: string;
};

/**
 * MVP stand-in for a real "active tournament" selection. The tournament
 * switcher (UX-BLUEPRINT.md §2) is still Phase 2 mock UI with no persisted
 * selection state (no cookie, no client-side store) — there is currently no
 * way for a real-data page to know which of a user's tournaments is
 * "active" other than picking one.
 *
 * Picks the participant's most-recently-joined tournament. Reasonable while
 * a user realistically belongs to one tournament at a time (ROADMAP.md
 * Phase 10: launch targets a single pilot Champions League pool) — replace
 * every call site with the real switcher's persisted selection once that's
 * built; this function is the one place that decision needs to change.
 */
export async function getCurrentParticipant(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<CurrentParticipant | null> {
  const { data } = await supabase
    .from("participants")
    .select("id, tournament_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; tournament_id: string }>();

  if (!data) return null;
  return { participantId: data.id, tournamentId: data.tournament_id };
}
