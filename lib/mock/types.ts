/**
 * Planning-level entity types for the Phase 2 static UI prototype.
 *
 * Shaped after DATABASE.md §2-3 (conceptual data model — not final DDL; the
 * real Drizzle schema is written in Phase 3). These types exist only to give
 * the mock fixtures in this folder — and the screens that consume them — a
 * stable, typed shape to build against ahead of a real database.
 */

export type ParticipantRole = "tournament_admin" | "participant";

export type MatchStage = "group" | "semifinal" | "final";

export type MatchStatus = "scheduled" | "live" | "finished";

export type PredictionOutcome =
  "exact" | "winner_diff" | "winner" | "draw_correct" | "wrong";

export interface Team {
  id: string;
  name: string;
  shortName: string;
  flagEmoji: string;
  group: "A" | "B";
  seed: number;
}

export interface Score {
  home: number;
  away: number;
}

export interface Match {
  id: string;
  tournamentId: string;
  stage: MatchStage;
  group: "A" | "B" | null;
  matchday: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoff: string; // ISO timestamp
  lockTime: string; // ISO timestamp — predictions close here
  status: MatchStatus;
  /** Canonical 90-minute + stoppage result — the only input to prediction scoring. */
  regularResult: Score | null;
  /** Present only for knockout matches that went past 90 minutes. */
  extraTimeResult: Score | null;
  penaltyResult: Score | null;
  /** In-progress score for a `status: "live"` match; null otherwise. */
  liveScore: Score | null;
}

export interface Participant {
  id: string;
  displayName: string;
  avatarInitials: string;
  role: ParticipantRole;
  totalPoints: number;
  matchPoints: number;
  groupRankingPoints: number;
  bonusPoints: number;
  rank: number;
  previousRank: number;
  accuracyPercent: number;
  streak: number;
}

export interface MatchPrediction {
  id: string;
  matchId: string;
  participantId: string;
  predictedHome: number;
  predictedAway: number;
  submittedAt: string;
  pointsEarned: number | null;
  outcome: PredictionOutcome | null;
}

export interface GroupStanding {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalDiff: number;
  points: number;
}

export interface GroupPrediction {
  group: "A" | "B";
  participantId: string;
  predictedOrder: string[]; // team ids, predicted finishing order
  pointsEarned: number | null;
  finalized: boolean;
}

export interface BonusSlot {
  id: string;
  index: number;
  points: number;
}

export interface BonusCategory {
  id: string;
  name: string;
  type: "player" | "team";
  resolvesAt: "ongoing" | "tournament_end";
  duplicateStackingAllowed: boolean;
  slots: BonusSlot[];
}

export interface BonusPick {
  slotId: string;
  pickLabel: string;
}

export interface BonusPrediction {
  categoryId: string;
  participantId: string;
  picks: BonusPick[];
  pointsEarned: number | null;
}

export interface BonusLeaderEntry {
  label: string;
  value: number;
  rank: number;
}

export interface Prize {
  rank: number;
  description: string;
}

export interface Tournament {
  id: string;
  name: string;
  competition: string;
  status: "upcoming" | "active" | "finished";
}

export type SyncOutcome = "success" | "error";

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  outcome: SyncOutcome;
  durationMs: number;
  errorDetail: string | null;
}

export interface AdminOverrideEntry {
  id: string;
  reason: string;
  enteredBy: string;
  timestamp: string;
  reversible: boolean;
}
