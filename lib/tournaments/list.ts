import "server-only";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type UserTournament = {
  id: string;
  name: string;
  competition: string;
  isCurrent: boolean;
};

type ParticipantRow = { tournament_id: string };
type TournamentRow = { id: string; name: string; competition: string };

/**
 * All tournaments the caller is a participant of — backs the tournament
 * switcher (UX-BLUEPRINT.md §1-2, task #80). `currentTournamentId` is
 * whatever `getCurrentParticipant` (lib/tournaments/current.ts) already
 * resolved, so this doesn't duplicate that cookie/most-recent-joined
 * resolution logic — it just marks the matching row `isCurrent` and sorts
 * it first, matching the switcher's existing [current, ...others] layout.
 */
export async function getUserTournaments(
  supabase: SupabaseServerClient,
  userId: string,
  currentTournamentId: string | null,
): Promise<UserTournament[]> {
  const { data: participantRows } = await supabase
    .from("participants")
    .select("tournament_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .returns<ParticipantRow[]>();

  if (!participantRows || participantRows.length === 0) return [];

  const tournamentIds = participantRows.map((p) => p.tournament_id);
  const { data: tournamentRows } = await supabase
    .from("tournaments")
    .select("id, name, competition")
    .in("id", tournamentIds)
    .returns<TournamentRow[]>();

  const byId = new Map((tournamentRows ?? []).map((t) => [t.id, t]));

  const summaries = tournamentIds
    .map((id) => byId.get(id))
    .filter((t): t is TournamentRow => t !== undefined)
    .map((t) => ({
      id: t.id,
      name: t.name,
      competition: t.competition,
      isCurrent: t.id === currentTournamentId,
    }));

  return [
    ...summaries.filter((t) => t.isCurrent),
    ...summaries.filter((t) => !t.isCurrent),
  ];
}
