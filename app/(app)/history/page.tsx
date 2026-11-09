import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { groupRounds, type RoundStanding } from "@/lib/history/rounds";
import { allowsRetrospectiveEntry } from "@/lib/tournaments/onboarding";
import { RoundHistory } from "@/app/_components/round-history";
import { EmptyState } from "@/app/_components/ui";
export const dynamic = "force-dynamic";
export default async function HistoryPage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const current = user ? await getCurrentParticipant(client, user.id) : null;
  if (!current)
    return <EmptyState message="הצטרפו לטורניר כדי לראות את סיפור העונה." />;
  const [history, games, tournament] = await Promise.all([
    client
      .from("round_history")
      .select("round_key,label,captured_at,standings,tracked_open")
      .eq("tournament_id", current.tournamentId)
      .order("captured_at", { ascending: true }),
    client
      .from("matches")
      .select(
        "id,stage,matchday,kickoff,status,regular_result,normalization_status",
      )
      .eq("tournament_id", current.tournamentId),
    client
      .from("tournaments")
      .select("onboarding_open,onboarding_matchday")
      .eq("id", current.tournamentId)
      .single(),
  ]);
  if (history.error || games.error || tournament.error)
    throw new Error("לא ניתן לטעון את היסטוריית המחזורים כרגע. נסו שוב.");
  const records = (history.data ?? [])
    .filter((r) => r.captured_at && r.standings)
    .map((r) => ({
      key: r.round_key,
      label: r.label,
      capturedAt: r.captured_at,
      standings: r.standings as RoundStanding[],
    }));
  const rounds = groupRounds(
    (games.data ?? []).map((m) => ({
      ...m,
      regularResult: m.regular_result,
      normalizationStatus: m.normalization_status,
    })),
  );
  const pending = rounds
    .filter((r) => !records.some((record) => record.key === r.key))
    .slice(0, 3)
    .map((r) => ({
      key: r.key,
      label: r.label,
      finished: r.matches.filter((m) => m.status === "finished").length,
      total: r.matches.filter((m) => m.status !== "cancelled").length,
      onboarding: r.matches.some((m) =>
        allowsRetrospectiveEntry(tournament.data, m),
      ),
      historical:
        history.data?.some((h) => h.round_key === r.key && !h.tracked_open) ??
        false,
    }));
  return (
    <RoundHistory
      key={current.participantId}
      records={records}
      selfId={current.participantId}
      pending={pending}
    />
  );
}
