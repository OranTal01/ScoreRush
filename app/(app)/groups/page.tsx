import { footballName } from "@/lib/content/football-names";
import { parseRankingConfig, rankingBands } from "@/lib/scoring/ranking-config";
import { BandPredictionForm } from "./_components/band-prediction-form";
import { isPast } from "@/lib/time";
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
  kickoff: string;
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
      <header>
        <h1 className="page-heading">דירוג הקבוצות</h1>
        <p className="page-intro mt-2">
          מי תסיים בצמרת? בחרו את מיקומי הקבוצות בסוף השלב.
        </p>
      </header>
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

  const [{ data: rawTeams }, { data: matches }, { data: predictions }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, short_name, group")
        .eq("tournament_id", tournamentId)
        .returns<TeamRow[]>(),
      supabase
        .from("matches")
        .select(
          "status, kickoff, group, home_team_id, away_team_id, regular_result",
        )
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

  const { data: rules, error: rulesError } = await supabase
    .from("scoring_rules")
    .select(
      "ranking_config, ranking_locks_at, group_ranking_points_per_position, tournaments(onboarding_open)",
    )
    .eq("tournament_id", tournamentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rulesError) throw new Error("לא ניתן לטעון את חוקי הדירוג");
  const onboarding =
    (rules?.tournaments as { onboarding_open?: boolean } | null)
      ?.onboarding_open === true;
  const rankingConfig = parseRankingConfig(rules?.ranking_config);
  const bands = rankingBands(rankingConfig);

  const teams = rawTeams?.map((t) => ({
    ...t,
    short_name: footballName(t.short_name),
  }));
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
      {onboarding && (
        <p className="rounded-2xl border border-amber-400/30 p-4 text-sm leading-6">
          הדירוג פתוח במהלך תקופת הקליטה. הזינו את הבחירות שכבר שלחתם למארגן.
        </p>
      )}
      {groupLabels.map((group, index) => {
        const rows = standings
          .filter((r) => r.group === group)
          .sort((a, b) => a.position - b.position);
        const groupTeams = (teams ?? []).filter((t) => t.group === group);
        const prediction = predictionByGroup.get(group) ?? null;
        const groupKickoffs = (matches ?? [])
          .filter((m) => m.group === group)
          .map((m) => Date.parse(m.kickoff));
        const deadline =
          rules?.ranking_locks_at ??
          (groupKickoffs.length
            ? new Date(Math.min(...groupKickoffs)).toISOString()
            : null);
        const locked = !onboarding && (deadline === null || isPast(deadline));
        const advancingCount = group === "league" ? 8 : 2;

        const orderedForForm =
          prediction?.predicted_order
            .map((id) => teamById.get(id))
            .filter((t): t is TeamRow => t !== undefined) ?? groupTeams;

        return (
          <MotionIn key={group} index={index}>
            <Card className="flex flex-col gap-3">
              <SectionHeader title={content.groupLabel(group)} />

              <details className="rounded-xl border border-white/10 p-3">
                <summary className="cursor-pointer text-sm font-bold">
                  טבלת התוצאות הנוכחית
                </summary>
                <p className="my-2 text-xs text-[var(--text-muted)]">
                  הטבלה מתעדכנת עם התוצאות; הדירוג הסופי נקבע לפי הטבלה הרשמית.
                </p>
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
                                  className="ltr box-border flex h-5 w-5 shrink-0 items-center justify-center text-[10.5px] font-extrabold tabular-nums"
                                  style={{
                                    borderRadius: "50%",
                                    background:
                                      index < advancingCount
                                        ? "rgba(79,175,131,0.16)"
                                        : colors.surfaceCard2,
                                    color:
                                      index < advancingCount
                                        ? colors.success
                                        : colors.textSecondary,
                                    border:
                                      index < advancingCount
                                        ? `1.5px solid ${colors.success}`
                                        : "1.5px solid transparent",
                                  }}
                                >
                                  {index + 1}
                                </span>
                                {team?.short_name ?? row.teamId}
                                {index < advancingCount && (
                                  <span className="sr-only">
                                    {content.advancesLabel}
                                  </span>
                                )}
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
              </details>

              {locked ? (
                <div
                  className="border-t pt-3"
                  style={{ borderColor: colors.border }}
                >
                  <p className="mb-1.5 text-[10.5px] font-semibold text-[var(--text-muted)]">
                    {prediction?.finalized
                      ? content.finalizedLabel
                      : "הדירוג נעול — הנקודות יחושבו בסיום שלב הליגה"}
                  </p>
                  {rankingConfig.mode === "bands" ? (
                    <div className="flex flex-col gap-3">
                      {bands.map((band) => (
                        <section
                          key={band.index}
                          className="rounded-xl border border-white/10 p-3"
                        >
                          <h3 className="mb-2 text-sm font-bold">
                            מקומות <bdi>{band.label}</bdi>
                          </h3>
                          <p className="text-sm leading-7 text-[var(--text-secondary)]">
                            {prediction?.predicted_order
                              .slice(band.start, band.end)
                              .map((id) => teamById.get(id)?.short_name ?? id)
                              .join(" · ") || "לא הוגש ניחוש"}
                          </p>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <ol className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                      {prediction?.predicted_order.map((teamId, index) => (
                        <li key={teamId} className="flex items-center gap-1">
                          <span className="ltr text-[var(--text-muted)] tabular-nums">
                            {index + 1}.
                          </span>
                          <span>
                            {teamById.get(teamId)?.short_name ?? teamId}
                          </span>
                          {index <
                            (prediction?.predicted_order.length ?? 0) - 1 && (
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
                  )}
                </div>
              ) : groupTeams.length >= 2 ? (
                <div>
                  <p className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                    {content.predictionLabel}
                  </p>
                  {rankingConfig.mode === "bands" ? (
                    <BandPredictionForm
                      group={group}
                      teams={groupTeams.map((team) => ({
                        id: team.id,
                        label: team.short_name,
                      }))}
                      config={rankingConfig}
                      savedOrder={prediction?.predicted_order}
                      points={rules?.group_ranking_points_per_position ?? 3}
                    />
                  ) : (
                    <GroupPredictionForm
                      group={group}
                      teams={orderedForForm.map((t) => ({
                        id: t.id,
                        label: t.short_name,
                      }))}
                    />
                  )}
                </div>
              ) : null}
            </Card>
          </MotionIn>
        );
      })}
    </Shell>
  );
}
