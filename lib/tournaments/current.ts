import "server-only";
import { cookies } from "next/headers";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type CurrentParticipant = {
  participantId: string;
  tournamentId: string;
};

/** Cookie the switcher's `switchTournament` action (app/_components/nav/actions.ts) writes — the one persisted record of the caller's explicit selection. */
export const ACTIVE_TOURNAMENT_COOKIE = "active_tournament_id";

/**
 * Real "active tournament" resolution (task #80): prefers the switcher's
 * persisted cookie selection, falling back to the participant's
 * most-recently-joined tournament when there's no cookie, or the cookie
 * names a tournament the caller isn't (or is no longer) a participant of —
 * e.g. a stale cookie from before being removed, or one left over from a
 * different account on a shared browser.
 *
 * Every existing call site already goes through this one function
 * (ROADMAP.md Phase 9 gap-fill tasks #76-79 and the rest of the app shell),
 * so making it cookie-aware here is enough to make the switcher's choice
 * stick everywhere, with no call site needing to change.
 */
export async function getCurrentParticipant(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<CurrentParticipant | null> {
  const preferredTournamentId = (await cookies()).get(
    ACTIVE_TOURNAMENT_COOKIE,
  )?.value;

  if (preferredTournamentId) {
    const { data } = await supabase
      .from("participants")
      .select("id, tournament_id")
      .eq("user_id", userId)
      .eq("tournament_id", preferredTournamentId)
      .maybeSingle<{ id: string; tournament_id: string }>();
    if (data)
      return { participantId: data.id, tournamentId: data.tournament_id };
  }

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
