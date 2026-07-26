import { colors, gradients } from "@/lib/design-tokens";
import {
  auth as authContent,
  common,
  profile as content,
  scoring,
  tournamentSwitcher,
} from "@/lib/content/he";
import { listTournamentMatches } from "@/lib/matches/list";
import { computeStandings, type StandingsInput } from "@/lib/scoring/leaderboard";
import { computePredictionStreaks } from "@/lib/scoring/streaks";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { Avatar, Card, EmptyState, Pill, SectionHeader } from "../../_components/ui";
import { signOut } from "../../auth/actions";

type ParticipantRow = {
  id: string;
  tournament_id: string;
  role: "tournament_admin" | "participant";
  display_name: string;
  avatar_initials: string | null;
};
type TournamentRow = { id: string; name: string; competition: string };
type SnapshotRow = {
  participant_id: string;
  rank: number;
  match_points: number;
  group_ranking_points: number;
  bonus_points: number;
  captured_at: string;
};

/** Same batching approach as leaderboard/page.tsx and home (app/(app)/page.tsx):
 * every row from one snapshot capture shares an identical `captured_at`. */
function groupIntoBatches(rows: SnapshotRow[]): SnapshotRow[][] {
  const byTimestamp = new Map<number, SnapshotRow[]>();
  for (const row of rows) {
    const key = new Date(row.captured_at).getTime();
    const batch = byTimestamp.get(key);
    if (batch) batch.push(row);
    else byTimestamp.set(key, [row]);
  }
  return [...byTimestamp.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, batch]) => batch);
}

export const dynamic = "force-dynamic";

/**
 * Screen 9/16 combined (UX-BLUEPRINT.md): public-facing profile — rank
 * history, achievements, streaks, prediction accuracy — plus the
 * account-level linked-tournaments list.
 *
 * Real-data pass (ROADMAP.md Phase 9 gap-fill, predates the phase itself) —
 * this screen ran entirely on `@/lib/mock` fixtures through Phases 2-8, see
 * lib/matches/list.ts's doc comment for why. Guard chain, standings
 * recompute, and streak computation all mirror leaderboard/page.tsx and the
 * home dashboard (app/(app)/page.tsx) exactly — same `getCurrentParticipant`
 * MVP stand-in, same `computeStandings`/`computePredictionStreaks` reuse.
 *
 * "Linked tournaments" reads every `participants` row for the caller's own
 * `user_id` (RLS's `participants_select_members` policy allows this — a
 * user's own membership row always proves membership of that row's
 * tournament) and the matching `tournaments` rows, active tournament first.
 * "Edit profile" stays a non-functional stub, same as the Phase 2 mock —
 * no edit flow exists yet, out of scope here.
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <EmptyState message={content.errorUnauthenticated} />;
  }

  const current = await getCurrentParticipant(supabase, user.id);
  if (!current) {
    return <EmptyState message={content.errorNotAMember} />;
  }
  const { tournamentId, participantId: selfId } = current;

  const [
    { data: myParticipantRows },
    { data: tournamentParticipants },
    { data: snapshotRows },
    matches,
  ] = await Promise.all([
    supabase
      .from("participants")
      .select("id, tournament_id, role, display_name, avatar_initials")
      .eq("user_id", user.id)
      .returns<ParticipantRow[]>(),
    supabase
      .from("participants")
      .select("id, tournament_id, role, display_name, avatar_initials")
      .eq("tournament_id", tournamentId)
      .returns<ParticipantRow[]>(),
    supabase
      .from("leaderboard_snapshots")
      .select(
        "participant_id, rank, match_points, group_ranking_points, bonus_points, captured_at",
      )
      .eq("tournament_id", tournamentId)
      .returns<SnapshotRow[]>(),
    listTournamentMatches(supabase, tournamentId, selfId),
  ]);

  const self = (myParticipantRows ?? []).find((p) => p.id === selfId);
  if (!self) {
    return <EmptyState message={content.errorNotAMember} />;
  }

  const tournamentIds = [
    ...new Set((myParticipantRows ?? []).map((p) => p.tournament_id)),
  ];
  const { data: tournamentRows } = await supabase
    .from("tournaments")
    .select("id, name, competition")
    .in("id", tournamentIds)
    .returns<TournamentRow[]>();
  const tournamentById = new Map((tournamentRows ?? []).map((t) => [t.id, t]));
  const linkedTournaments = [
    ...tournamentIds.filter((id) => id === tournamentId),
    ...tournamentIds.filter((id) => id !== tournamentId),
  ]
    .map((id) => tournamentById.get(id))
    .filter((t): t is TournamentRow => t !== undefined);

  const batches = groupIntoBatches(snapshotRows ?? []);
  const latestBatch = batches[0] ?? [];
  const previousBatch = batches[1] ?? [];
  const latestByParticipant = new Map(latestBatch.map((r) => [r.participant_id, r]));
  const previousRankByParticipant = new Map(
    previousBatch.map((r) => [r.participant_id, r.rank]),
  );
  const standingsInput: StandingsInput[] = (tournamentParticipants ?? []).map((p) => {
    const latest = latestByParticipant.get(p.id);
    return {
      participantId: p.id,
      matchPoints: latest?.match_points ?? 0,
      groupRankingPoints: latest?.group_ranking_points ?? 0,
      bonusPoints: latest?.bonus_points ?? 0,
    };
  });
  const standings = computeStandings(standingsInput);
  const selfStanding = standings.find((s) => s.participantId === selfId);
  const selfRank = selfStanding?.rank ?? 0;
  const selfPreviousRank = previousRankByParticipant.get(selfId) ?? selfRank;
  const rankMoved = selfPreviousRank - selfRank;

  const { exactStreak, correctStreak, accuracyPercent } = computePredictionStreaks(
    matches
      .filter((m) => m.ownPrediction !== null)
      .map((m) => ({ kickoff: m.kickoff, outcome: m.ownPrediction!.outcome })),
  );

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[480px]">
      <Card padding="hero" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: gradients.hero }}
        />
        <div className="relative flex flex-col items-center gap-3 text-center">
          <Avatar initials={self.avatar_initials ?? "?"} self size={72} />
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-extrabold text-[var(--text-primary)]">
              {self.display_name}
            </span>
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {self.role === "tournament_admin"
                ? content.roleAdmin
                : content.roleParticipant}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-0.5">
              <span className="ltr text-2xl font-black text-[var(--gold)] tabular-nums">
                {selfStanding?.totalPoints ?? 0}
              </span>
              <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                {common.points}
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="ltr text-2xl font-black text-[var(--text-primary)] tabular-nums">
                {selfRank}
              </span>
              <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                {common.rank}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="px-4 py-2 text-xs font-bold text-[var(--text-primary)]"
            style={{
              background: colors.surfaceCard2,
              borderRadius: "var(--radius-button)",
            }}
          >
            {content.editProfile}
          </button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.rankHistoryLabel} />
        {rankMoved !== 0 ? (
          <Pill tone={rankMoved > 0 ? "success" : "danger"}>
            {rankMoved > 0 ? scoring.rankUp : scoring.rankDown} ·{" "}
            {Math.abs(rankMoved)} מקומות
          </Pill>
        ) : (
          <Pill tone="muted">
            {content.rankUnchanged} · {common.rank} {selfRank}
          </Pill>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.achievementsLabel} />
        {accuracyPercent === null ? (
          <EmptyState message={content.noAchievementsYet} />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Pill tone="gold">
              🎯 {content.exactStreaksLabel} · {exactStreak}
            </Pill>
            <Pill tone="interactive">
              🔥 {content.streaksLabel} · {correctStreak}
            </Pill>
            <Pill tone="muted">
              📈 {content.accuracyLabel} · {accuracyPercent}%
            </Pill>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.linkedTournaments} />
        <ul className="flex flex-col gap-2">
          {linkedTournaments.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex flex-col">
                <span className="font-bold text-[var(--text-primary)]">
                  {t.name}
                </span>
                <span className="text-[var(--text-muted)]">{t.competition}</span>
              </div>
              {t.id === tournamentId && (
                <Pill tone="interactive">{tournamentSwitcher.activeLabel}</Pill>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <form action={signOut}>
        <button
          type="submit"
          className="w-full py-3 text-xs font-bold text-[var(--danger)]"
          style={{
            background: colors.surfaceCard2,
            borderRadius: "var(--radius-button)",
          }}
        >
          {authContent.signOut}
        </button>
      </form>
    </div>
  );
}
