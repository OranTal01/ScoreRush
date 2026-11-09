import { CHAMPIONS_LEAGUE_RANKING } from "@/lib/scoring/ranking-config";

// Editable starting templates. Every created tournament stores its own copy.
export const CHAMPIONS_LEAGUE_PRESET = {
  ranking: CHAMPIONS_LEAGUE_RANKING,
  categories: [
    {
      name: "האלופה",
      type: "team",
      statKey: "champion",
      resolvesAt: "tournament_end",
      points: [30, 20],
    },
    {
      name: "סגנית האלופה",
      type: "team",
      statKey: "runner_up",
      resolvesAt: "tournament_end",
      points: [20, 10],
    },
    {
      name: "הקבוצה המבקיעה ביותר",
      type: "team",
      statKey: "top_scoring_team",
      resolvesAt: "tournament_end",
      points: [20, 10, 10],
    },
    {
      name: "מקום ראשון בסיום שלב הליגה",
      type: "team",
      statKey: "league_winner",
      resolvesAt: "ongoing",
      points: [20, 10, 10],
    },
    {
      name: "מלך השערים",
      type: "player",
      statKey: "top_scorer",
      resolvesAt: "tournament_end",
      points: [20, 10, 10, 10],
    },
    {
      name: "מלך הבישולים",
      type: "player",
      statKey: "top_assists",
      resolvesAt: "tournament_end",
      points: [20, 10, 10, 10],
    },
  ],
} as const;
