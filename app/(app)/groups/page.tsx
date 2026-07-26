import type { ReactNode } from "react";
import { groups as content } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import {
  calculateGroupStandings,
  type StandingsMatch,
} from "@/lib/scoring/group-standings";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { MotionIn } from "../../_components/motion/motion-in";
import { SubTabs } from "../../_components/nav/sub-tabs";
import { Card, EmptyState, SectionHeader } from "../../_components/ui";
import { GroupPredictionForm } from "./_components/group-prediction-form";

type MatchStatus =
  "scheduled" | "live" | "finished" | "postponed" | "cancelled";
type Score = { home: number; away: number };

type TeamRow = { id: string; short_name: string; group: string | null };
type MatchRow = {
  status: MatchStatus;
  group: string | null;
  home_team_id: string;
  away_team_id: string;
  regular_result: Score | null;
};
type GroupPredictionRow = {
  group: string;
  predicted_order: string[];
  points_earned: number | null;
  finalized: boolean;
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[560px] lg:max-w-[640px]">
      <SubTabs />
      {children}
    </div>
  );
}

export const dynamic = "force-dynamic";

/** Screen 11 (UX-BLUEPRINT.md): group-stage tables + group ranking
 * predictions, wired to real data via RLS-scoped queries.
 * `getCurrentParticipant` (lib/tournaments/current.ts) picks the caller's
 * most-recently-joined tournament — a documented MVP stand-in until the real
 * tournament switcher exists (UX-BLUEPRINT.md §2, still Phase 2 mock UI). */
export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Shell>
        <EmptyState message={content.errorUnauthenticated} />
      </Shell>
    );
  }

  const current = await getCurrentParticipant(supabase, user.id);
  if (!current) {
    return (
      <Shell>
        <EmptyState message={content.errorNotAMember} />
      </Shell>
    );
  }
  const { participantId, tournamentId } = current;

  const [{ data: teams }, { data: matches }, { data: predictions }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, short_name, group")
        .eq("tournament_id", tournamentId)
        .returns<TeamRow[]>(),
      supabase
        .from("matches")
        .select("status, group, home_team_id, away_team_id, regular_result")
        .eq("tournament_id", tournamentId)
        .not("group", "is", null)
        .returns<MatchRow[]>(),
      supabase
        .from("group_predictions")
        .select("group, predicted_order, points_earned, finalized")
        .eq("tournament_id", tournamentId)
        .eq("participant_id", participantId)
        .returns<GroupPredictionRow[]>(),
    ]);

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const groupLabels = [
    ...new Set(
      (teams ?? []).map((t) => t.group).filter((g): g is string => g !== null),
    ),
  ].sort();

  if (groupLabels.length === 0) {
    return (
      <Shell>
        <EmptyState message={content.emptyState} />
      </Shell>
    );
  }

  const standingsMatches: StandingsMatch[] = (matches ?? []).map((m) => ({
    status: m.status,
    group: m.group,
    homeTeamId: m.home_team_id,
    awayTeamId: m.away_team_id,
    regularResult: m.regular_result,
  }));
  const standings = calculateGroupStandings(standingsMatches);
  const predictionByGroup = new Map(
    (predictions ?? []).map((p) => [p.group, p]),
  );

  return (
    <Shell>
      {groupLabels.map((group, index) => {
        const rows = standings
          .filter((r) => r.group === group)
          .sort((a, b) => a.position - b.position);
        const groupTeams = (teams ?? []).filter((t) => t.group === group);
        const prediction = predictionByGroup.get(group) ?? null;

        const orderedForForm =
          prediction?.predicted_order
            .map((id) => teamById.get(id))
            .filter((t): t is TeamRow => t !== undefined) ?? groupTeams;

        return (
          <MotionIn key={group} index={index}>
            <Card className="flex flex-col gap-3">
              <SectionHeader title={content.groupLabel(group)} />

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                      <th className="py-1 text-start font-semibold">
                        {content.tableHeaders.team}
                      </th>
                      <th className="py-1 text-center font-semibold">
                        {content.tableHeaders.played}
                      </th>
                      <th className="py-1 text-center font-semibold">
                        {content.tableHeaders.won}
                      </th>
                      <th className="py-1 text-center font-semibold">
                        {content.tableHeaders.drawn}
                      </th>
                      <th className="py-1 text-center font-semibold">
                        {content.tableHeaders.lost}
                      </th>
                      <th className="py-1 text-center font-semibold">
                        {content.tableHeaders.goalDiff}
                      </th>
                      <th className="py-1 text-center font-semibold">
                        {content.tableHeaders.points}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const team = teamById.get(row.teamId);
                      return (
                        <tr
                          key={row.teamId}
                          className="border-t"
                          style={{ borderColor: colors.border }}
                        >
                          <td className="py-2">
                            <span className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                              <span
                                className="ltr flex h-5 w-5 shrink-0 items-center justify-center text-[10.5px] font-extrabold tabular-nums"
                                style={{
                                  borderRadius: "50%",
                                  background:
                                    index < 2
                                      ? "rgba(79,175,131,0.16)"
                                      : colors.surfaceCard2,
                                  color:
                                    index < 2
                                      ? colors.success
                                      : colors.textSecondary,
                                }}
                              >
                                {index + 1}
                              </span>
                              {team?.short_name ?? row.teamId}
                            </span>
                          </td>
                          <td className="ltr py-2 text-center text-[var(--text-secondary)] tabular-nums">
                            {row.played}
                          </td>
                          <td className="ltr py-2 text-center text-[var(--text-secondary)] tabular-nums">
                            {row.won}
                          </td>
                          <td className="ltr py-2 text-center text-[var(--text-secondary)] tabular-nums">
                            {row.drawn}
                          </td>
                          <td className="ltr py-2 text-center text-[var(--text-secondary)] tabular-nums">
                            {row.lost}
                          </td>
                          <td className="ltr py-2 text-center text-[var(--text-secondary)] tabular-nums">
                            {row.goalDifference > 0
                              ? `+${row.goalDifference}`
                              : row.goalDifference}
                          </td>
                          <td className="ltr py-2 text-center font-extrabold text-[var(--text-primary)] tabular-nums">
                            {row.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {prediction?.finalized ? (
                <div
                  className="border-t pt-3"
                  style={{ borderColor: colors.border }}
                >
                  <p className="mb-1.5 text-[10.5px] font-semibold text-[var(--text-muted)]">
                    {content.finalizedLabel}
                  </p>
                  <ol className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                    {prediction.predicted_order.map((teamId, index) => (
                      <li key={teamId} className="flex items-center gap-1">
                        <span className="ltr text-[var(--text-muted)] tabular-nums">
                          {index + 1}.
                        </span>
                        <span>
                          {teamById.get(teamId)?.short_name ?? teamId}
                        </span>
                        {index < prediction.predicted_order.length - 1 && (
                          <span
                            aria-hidden
                            className="text-[var(--text-muted)]"
                          >
                            ·
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : groupTeams.length >= 2 ? (
                <div>
                  <p className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                    {content.predictionLabel}
                  </p>
                  <GroupPredictionForm
                    group={group}
                    teams={orderedForForm.map((t) => ({
                      id: t.id,
                      label: t.short_name,
                    }))}
                  />
                </div>
              ) : null}
            </Card>
          </MotionIn>
        );
      })}
    </Shell>
  );
}
