import {
  scoreMatchPrediction,
  type MatchScoringRules,
} from "@/lib/scoring/match-scoring";

export type HistoricalResult = {
  homeTeamId: string;
  awayTeamId: string;
  home: number;
  away: number;
  kickoff: Date;
};

const GOALS_PRIOR = 1.35;
const PRIOR_MATCHES = 4;

function rates(teamId: string, history: HistoricalResult[], now: Date) {
  let goalsFor = GOALS_PRIOR * PRIOR_MATCHES;
  let goalsAgainst = GOALS_PRIOR * PRIOR_MATCHES;
  let weight = PRIOR_MATCHES;
  for (const game of history) {
    const home = game.homeTeamId === teamId;
    if (!home && game.awayTeamId !== teamId) continue;
    const ageDays = Math.max(0, (+now - +game.kickoff) / 86400000);
    const w = Math.exp(-ageDays / 75);
    goalsFor += w * (home ? game.home : game.away);
    goalsAgainst += w * (home ? game.away : game.home);
    weight += w;
  }
  return { attack: goalsFor / weight, defense: goalsAgainst / weight };
}

function poisson(k: number, lambda: number) {
  let factorial = 1;
  for (let i = 2; i <= k; i++) factorial *= i;
  return (Math.exp(-lambda) * lambda ** k) / factorial;
}

/** Choose the score with the highest expected points under tournament rules. */
export function predictMatchScore(
  homeTeamId: string,
  awayTeamId: string,
  history: HistoricalResult[],
  rules: MatchScoringRules,
  now: Date,
) {
  const home = rates(homeTeamId, history, now);
  const away = rates(awayTeamId, history, now);
  const homeGoals = Math.min(
    3.6,
    Math.max(0.35, (home.attack + away.defense) / 2 + 0.18),
  );
  const awayGoals = Math.min(
    3.6,
    Math.max(0.35, (away.attack + home.defense) / 2 - 0.12),
  );
  let best = { home: 1, away: 1, expectedPoints: -Infinity };
  for (let ph = 0; ph <= 4; ph++) {
    for (let pa = 0; pa <= 4; pa++) {
      let expectedPoints = 0;
      for (let ah = 0; ah <= 7; ah++) {
        for (let aa = 0; aa <= 7; aa++) {
          expectedPoints +=
            poisson(ah, homeGoals) *
            poisson(aa, awayGoals) *
            scoreMatchPrediction(
              { home: ah, away: aa },
              { home: ph, away: pa },
              rules,
            ).points;
        }
      }
      if (expectedPoints > best.expectedPoints)
        best = { home: ph, away: pa, expectedPoints };
    }
  }
  return best;
}
