import { colors } from "@/lib/design-tokens";
import { groups as content } from "@/lib/content/he";
import { groupPredictions, groupStandings, teamById } from "@/lib/mock";
import { SubTabs } from "../../_components/nav/sub-tabs";
import { Card, SectionHeader } from "../../_components/ui";

const GROUPS = ["A", "B"] as const;

/** Screen 11 (UX-BLUEPRINT.md): group-stage tables and group ranking
 * predictions. Standings are partial — matchday 3 is still in progress, so
 * SCORING-RULES.md §5 group-ranking points aren't credited yet. */
export default function GroupsPage() {
  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[560px] lg:max-w-[640px]">
      <SubTabs />

      {GROUPS.map((group) => {
        const standings = groupStandings[group];
        const prediction = groupPredictions.find((gp) => gp.group === group);

        return (
          <Card key={group} className="flex flex-col gap-3">
            <SectionHeader title={content.groupLabel(group)} />

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                    <th className="py-1 text-start font-semibold">{content.tableHeaders.team}</th>
                    <th className="py-1 text-center font-semibold">{content.tableHeaders.played}</th>
                    <th className="py-1 text-center font-semibold">{content.tableHeaders.won}</th>
                    <th className="py-1 text-center font-semibold">{content.tableHeaders.drawn}</th>
                    <th className="py-1 text-center font-semibold">{content.tableHeaders.lost}</th>
                    <th className="py-1 text-center font-semibold">{content.tableHeaders.goalDiff}</th>
                    <th className="py-1 text-center font-semibold">{content.tableHeaders.points}</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, index) => {
                    const team = teamById(row.teamId);
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
                                background: index < 2 ? "rgba(79,175,131,0.16)" : colors.surfaceCard2,
                                color: index < 2 ? colors.success : colors.textSecondary,
                              }}
                            >
                              {index + 1}
                            </span>
                            <span aria-hidden>{team.flagEmoji}</span>
                            {team.shortName}
                          </span>
                        </td>
                        <td className="ltr py-2 text-center tabular-nums text-[var(--text-secondary)]">
                          {row.played}
                        </td>
                        <td className="ltr py-2 text-center tabular-nums text-[var(--text-secondary)]">
                          {row.won}
                        </td>
                        <td className="ltr py-2 text-center tabular-nums text-[var(--text-secondary)]">
                          {row.drawn}
                        </td>
                        <td className="ltr py-2 text-center tabular-nums text-[var(--text-secondary)]">
                          {row.lost}
                        </td>
                        <td className="ltr py-2 text-center tabular-nums text-[var(--text-secondary)]">
                          {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                        </td>
                        <td className="ltr py-2 text-center font-extrabold tabular-nums text-[var(--text-primary)]">
                          {row.points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {prediction && (
              <div className="border-t pt-3" style={{ borderColor: colors.border }}>
                <p className="mb-1.5 text-[10.5px] font-semibold text-[var(--text-muted)]">
                  {content.predictionLabel}
                </p>
                <ol className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  {prediction.predictedOrder.map((teamId, index) => (
                    <li key={teamId} className="flex items-center gap-1">
                      <span className="ltr text-[var(--text-muted)] tabular-nums">{index + 1}.</span>
                      <span>{teamById(teamId).shortName}</span>
                      {index < prediction.predictedOrder.length - 1 && (
                        <span aria-hidden className="text-[var(--text-muted)]">
                          ·
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
