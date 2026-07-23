/**
 * Group-stage standings, computed on the fly from `matches` rows (there is
 * no materialized standings table — DATABASE.md §2 models `matches` as the
 * single source of truth). Ported from the legacy project's
 * `calculateGroupStandings` (world-cup-bets/features/standings/domain/group-standings.ts),
 * same deterministic tie-break order.
 *
 * A match belongs to a group if `match.group !== null` — using the schema's
 * own nullable `group` column rather than pattern-matching on `stage` text,
 * since `stage` is free-form per provider (ARCHITECTURE.md §6) and a
 * football-data.org group match's normalized stage string ("group_stage")
 * isn't guaranteed to equal any particular literal. `group` being non-null
 * is the robust, provider-agnostic signal for group-stage membership.
 */
import type { MatchScore } from "@/lib/db/schema/competition";

export interface StandingsMatch {
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  group: string | null;
  homeTeamId: string;
  awayTeamId: string;
  regularResult: MatchScore | null;
}

export interface GroupStandingRow {
  group: string;
  position: number;
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface TeamStats {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

function emptyStats(teamId: string): TeamStats {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };
}

/**
 * All group-stage teams appear (zeroed) even with no finished matches yet;
 * stats only update from finished matches with a non-null `regularResult`.
 * Sort: points DESC -> goal difference DESC -> goals-for DESC -> teamId ASC
 * (deterministic tie-break; official multi-criteria FIFA tie-breakers are
 * intentionally not modeled — same simplification the legacy project made).
 */
export function calculateGroupStandings(
  matches: readonly StandingsMatch[],
): GroupStandingRow[] {
  const groupMap = new Map<string, Map<string, TeamStats>>();

  for (const match of matches) {
    if (match.group === null) continue;

    if (!groupMap.has(match.group)) groupMap.set(match.group, new Map());
    const teamMap = groupMap.get(match.group)!;

    if (!teamMap.has(match.homeTeamId)) {
      teamMap.set(match.homeTeamId, emptyStats(match.homeTeamId));
    }
    if (!teamMap.has(match.awayTeamId)) {
      teamMap.set(match.awayTeamId, emptyStats(match.awayTeamId));
    }

    if (match.status !== "finished" || match.regularResult === null) continue;

    const { home: homeGoals, away: awayGoals } = match.regularResult;
    const home = teamMap.get(match.homeTeamId)!;
    const away = teamMap.get(match.awayTeamId)!;

    home.played++;
    away.played++;
    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    if (homeGoals > awayGoals) {
      home.won++;
      away.lost++;
    } else if (awayGoals > homeGoals) {
      away.won++;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
    }
  }

  const result: GroupStandingRow[] = [];

  for (const [group, teamMap] of groupMap) {
    const teams = [...teamMap.values()].sort((a, b) => {
      const ptsA = a.won * 3 + a.drawn;
      const ptsB = b.won * 3 + b.drawn;
      if (ptsB !== ptsA) return ptsB - ptsA;

      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;

      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

      return a.teamId.localeCompare(b.teamId);
    });

    teams.forEach((s, index) => {
      result.push({
        group,
        position: index + 1,
        teamId: s.teamId,
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        goalsFor: s.goalsFor,
        goalsAgainst: s.goalsAgainst,
        goalDifference: s.goalsFor - s.goalsAgainst,
        points: s.won * 3 + s.drawn,
      });
    });
  }

  return result;
}

/**
 * A group stage is complete only when every group-stage match is finished
 * with a resolved regular-time result — matches legacy's
 * `isGroupStageComplete` gate. `group_predictions.finalized` (DATABASE.md §5
 * / the RLS migration) should be set to this value by the scoring recompute
 * pipeline (lib/scoring/recompute.ts), not decided independently elsewhere,
 * so "is the group stage over" has exactly one source of truth.
 */
export function isGroupStageComplete(matches: readonly StandingsMatch[]): boolean {
  const groupMatches = matches.filter((m) => m.group !== null);
  if (groupMatches.length === 0) return false;
  return groupMatches.every(
    (m) => m.status === "finished" && m.regularResult !== null,
  );
}

/**
 * Standings, keyed by group label, as an ordered array of team ids
 * (1st place first) — the shape `scoreGroupRanking` compares a participant's
 * predicted order against.
 */
export function standingsByGroup(
  standings: readonly GroupStandingRow[],
): Map<string, string[]> {
  const byGroup = new Map<string, GroupStandingRow[]>();
  for (const row of standings) {
    if (!byGroup.has(row.group)) byGroup.set(row.group, []);
    byGroup.get(row.group)!.push(row);
  }
  const result = new Map<string, string[]>();
  for (const [group, rows] of byGroup) {
    result.set(
      group,
      [...rows].sort((a, b) => a.position - b.position).map((r) => r.teamId),
    );
  }
  return result;
}
