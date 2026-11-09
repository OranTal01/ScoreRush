import type { MatchScore } from "@/lib/db/schema/competition";
export type LiveAccess = "delayed" | "scores" | "events";
export type LiveCard = {
  key: string;
  teamId: string;
  player: string | null;
  minute: number | null;
  type: "RED" | "YELLOW_RED";
};
export type LiveDetails = {
  regulationScore: MatchScore | null;
  period: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
  minute: number | null;
  sourceUpdatedAt: string | null;
  cards: LiveCard[] | null;
};
export type LiveObservation = {
  status: string;
  score: MatchScore | null;
  details: LiveDetails | null;
  observedAt: string;
};
export type LiveChange = {
  kind:
    | "goal"
    | "score_change"
    | "red_card"
    | "card_correction"
    | "kickoff"
    | "finished";
  side?: "home" | "away";
  card?: LiveCard;
  before: LiveObservation;
  after: LiveObservation;
};
export type LiveFeedEvent = {
  id: string;
  matchId: string;
  kind: LiveChange["kind"];
  description: string;
  createdAt: string;
};
export type LiveGame = {
  id: string;
  home: string;
  away: string;
  kickoff: string;
  status: string;
  score: MatchScore | null;
  details: LiveDetails | null;
  syncedAt: string | null;
  retrospective: boolean;
  ownPrediction: { home: number; away: number; isDefault: boolean } | null;
  temporaryPoints: number | null;
  temporaryOutcome: string | null;
  stale: boolean;
};
export type LiveStanding = {
  id: string;
  name: string;
  officialPoints: number;
  officialRank: number;
  projectedPoints: number;
  projectedRank: number;
  temporaryPoints: number;
};
export type LiveView = {
  tournamentId: string;
  tournamentName: string;
  selfId: string;
  access: LiveAccess;
  generatedAt: string;
  standings: LiveStanding[];
  games: LiveGame[];
  events: LiveFeedEvent[];
  projectedGames: number;
};
