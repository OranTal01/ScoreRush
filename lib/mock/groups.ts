import { matches } from "./matches";
import { teams } from "./teams";
import type { GroupStanding } from "./types";

/**
 * Standings are derived from the finished matchday 1-2 fixtures in
 * matches.ts (a plain reduction here, not a claim about where real scoring
 * logic will live — the actual domain/service layer is built in Phase 5/6
 * per ARCHITECTURE.md §2). Matchday 3 is still in progress, so these are
 * partial, not final, standings.
 */
function computeStandings(group: "A" | "B"): GroupStanding[] {
  const groupTeamIds = teams.filter((t) => t.group === group).map((t) => t.id);
  const table = new Map<string, GroupStanding>(
    groupTeamIds.map((id) => [
      id,
      { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, goalDiff: 0, points: 0 },
    ]),
  );

  for (const match of matches) {
    if (match.group !== group || match.status !== "finished" || !match.regularResult) {
      continue;
    }
    const { home, away } = match.regularResult;
    const homeRow = table.get(match.homeTeamId)!;
    const awayRow = table.get(match.awayTeamId)!;

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalDiff += home - away;
    awayRow.goalDiff += away - home;

    if (home > away) {
      homeRow.won += 1;
      homeRow.points += 3;
      awayRow.lost += 1;
    } else if (home < away) {
      awayRow.won += 1;
      awayRow.points += 3;
      homeRow.lost += 1;
    } else {
      homeRow.drawn += 1;
      awayRow.drawn += 1;
      homeRow.points += 1;
      awayRow.points += 1;
    }
  }

  return [...table.values()].sort(
    (a, b) => b.points - a.points || b.goalDiff - a.goalDiff,
  );
}

export const groupStandings: Record<"A" | "B", GroupStanding[]> = {
  A: computeStandings("A"),
  B: computeStandings("B"),
};
