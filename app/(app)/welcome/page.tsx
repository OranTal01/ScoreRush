import { currentTimeMs } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { listTournamentMatches } from "@/lib/matches/list";
import {
  canEditPrediction,
  hasSubmittedPrediction,
  focusMatches,
} from "@/lib/matches/progress";
import { WelcomeGuide } from "@/app/_components/welcome-guide";
import { EmptyState } from "@/app/_components/ui";
export const dynamic = "force-dynamic";
export default async function WelcomePage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const current = user ? await getCurrentParticipant(client, user.id) : null;
  if (!current)
    return <EmptyState message="הצטרפו לטורניר דרך ההזמנה שקיבלתם מהחבר׳ה." />;
  const [member, tournament, scoring, matches] = await Promise.all([
    client
      .from("participants")
      .select("display_name")
      .eq("id", current.participantId)
      .single(),
    client
      .from("tournaments")
      .select("name,match_lock_minutes")
      .eq("id", current.tournamentId)
      .single(),
    client
      .from("scoring_rules")
      .select(
        "exact_score_points,winner_and_diff_points,winner_only_points,wrong_points",
      )
      .eq("tournament_id", current.tournamentId)
      .order("version", { ascending: false })
      .limit(1)
      .single(),
    listTournamentMatches(client, current.tournamentId, current.participantId),
  ]);
  if (member.error || tournament.error || scoring.error)
    throw new Error("לא ניתן לטעון את ההיכרות כרגע. נסו שוב.");
  const now = currentTimeMs();
  const first =
    focusMatches(matches, now).find(
      (m) => canEditPrediction(m, now) && !hasSubmittedPrediction(m),
    ) ??
    matches.find(
      (m) => canEditPrediction(m, now) && !hasSubmittedPrediction(m),
    ) ??
    null;
  return (
    <WelcomeGuide
      key={current.participantId}
      scope={`${current.tournamentId}:${current.participantId}`}
      name={member.data.display_name}
      tournamentName={tournament.data.name}
      firstMatch={first}
      hasPrediction={matches.some(hasSubmittedPrediction)}
      rules={{
        exact: scoring.data.exact_score_points,
        difference: scoring.data.winner_and_diff_points,
        winner: scoring.data.winner_only_points,
        wrong: scoring.data.wrong_points,
        lockMinutes: tournament.data.match_lock_minutes,
      }}
    />
  );
}
