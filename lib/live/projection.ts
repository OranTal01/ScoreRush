import {
  computeStandings,
  type StandingsInput,
} from "@/lib/scoring/leaderboard";
import {
  scoreMatchPrediction,
  type MatchScoringRules,
} from "@/lib/scoring/match-scoring";
import type { MatchScore } from "@/lib/db/schema/competition";
export type ProjectionMatch = {
  id: string;
  status: string;
  regulationScore: MatchScore | null;
  locked: boolean;
  fresh: boolean;
  normalized: boolean;
};
export type ProjectionPick = {
  matchId: string;
  participantId: string;
  home: number;
  away: number;
  points: number | null;
};
export function projectStandings(
  members: (StandingsInput & { name: string })[],
  matches: ProjectionMatch[],
  picks: ProjectionPick[],
  rules: MatchScoringRules,
) {
  const eligible = matches.filter(
    (m) =>
      m.status === "live" &&
      m.locked &&
      m.fresh &&
      m.normalized &&
      m.regulationScore,
  );
  const official = computeStandings(members);
  const delta = new Map<string, number>();
  for (const member of members)
    for (const match of eligible) {
      const pick = picks.find(
        (p) =>
          p.participantId === member.participantId && p.matchId === match.id,
      );
      // Missing picks follow the existing tournament rule, 0–0. Never change or
      // persist a prediction or authoritative score as part of this preview.
      const points = scoreMatchPrediction(
        match.regulationScore!,
        { home: pick?.home ?? 0, away: pick?.away ?? 0 },
        rules,
      ).points;
      delta.set(
        member.participantId,
        (delta.get(member.participantId) ?? 0) + points - (pick?.points ?? 0),
      );
    }
  const projected = computeStandings(
    members.map((p) => ({
      ...p,
      matchPoints: p.matchPoints + (delta.get(p.participantId) ?? 0),
    })),
  );
  return {
    projectedGames: eligible.length,
    standings: projected.map((p) => {
      const base = official.find((o) => o.participantId === p.participantId)!;
      return {
        id: p.participantId,
        name: members.find((m) => m.participantId === p.participantId)!.name,
        officialPoints: base.totalPoints,
        officialRank: base.rank,
        projectedPoints: p.totalPoints,
        projectedRank: p.rank,
        temporaryPoints: delta.get(p.participantId) ?? 0,
      };
    }),
  };
}
