import type { Participant } from "./types";

/**
 * `me` is the signed-in mock user for this static prototype — also the
 * tournament admin, matching the "only the platform owner can create
 * tournaments in MVP" decision (the organizer plays too, a common pattern).
 * `groupRankingPoints` is 0 for everyone: SCORING-RULES.md §5 — group points
 * are only added once the entire group stage is complete, and matchday 3
 * (the deciding round) is still in progress in this mock tournament.
 */
export const currentParticipantId = "me";

// matchPoints values below are capped by reality: only 8 matchday-1/2 matches
// have finished so far (max possible = 8 x 9 = 72 under the 9/6/3/0 default
// scoring in SCORING-RULES.md §2). `me`'s 51 exactly matches the sum of the
// fixtures in predictions.ts, so the Predictions/match-detail screens and the
// Leaderboard screen agree with each other.
export const participants: Participant[] = [
  {
    id: "p-yuval",
    displayName: "יובל לוי",
    avatarInitials: "יל",
    role: "participant",
    matchPoints: 60,
    groupRankingPoints: 0,
    bonusPoints: 24,
    totalPoints: 84,
    rank: 1,
    previousRank: 2,
    accuracyPercent: 61,
    streak: 4,
  },
  {
    id: "me",
    displayName: "אורן ט.",
    avatarInitials: "אט",
    role: "tournament_admin",
    matchPoints: 51,
    groupRankingPoints: 0,
    bonusPoints: 18,
    totalPoints: 69,
    rank: 2,
    previousRank: 1,
    accuracyPercent: 58,
    streak: 2,
  },
  {
    id: "p-maya",
    displayName: "מאיה בר",
    avatarInitials: "מב",
    role: "participant",
    matchPoints: 48,
    groupRankingPoints: 0,
    bonusPoints: 15,
    totalPoints: 63,
    rank: 3,
    previousRank: 3,
    accuracyPercent: 55,
    streak: 0,
  },
  {
    id: "p-shira",
    displayName: "שירה מור",
    avatarInitials: "שמ",
    role: "participant",
    matchPoints: 45,
    groupRankingPoints: 0,
    bonusPoints: 12,
    totalPoints: 57,
    rank: 4,
    previousRank: 5,
    accuracyPercent: 52,
    streak: 3,
  },
  {
    id: "p-noa",
    displayName: "נועה גולן",
    avatarInitials: "נג",
    role: "participant",
    matchPoints: 42,
    groupRankingPoints: 0,
    bonusPoints: 12,
    totalPoints: 54,
    rank: 5,
    previousRank: 4,
    accuracyPercent: 50,
    streak: 0,
  },
  {
    id: "p-tomer",
    displayName: "תומר אזולאי",
    avatarInitials: "תא",
    role: "participant",
    matchPoints: 39,
    groupRankingPoints: 0,
    bonusPoints: 9,
    totalPoints: 48,
    rank: 6,
    previousRank: 6,
    accuracyPercent: 46,
    streak: 1,
  },
  {
    id: "p-dana",
    displayName: "דנה כהן",
    avatarInitials: "דכ",
    role: "participant",
    matchPoints: 36,
    groupRankingPoints: 0,
    bonusPoints: 6,
    totalPoints: 42,
    rank: 7,
    previousRank: 8,
    accuracyPercent: 44,
    streak: 0,
  },
  {
    id: "p-idan",
    displayName: "עידן שי",
    avatarInitials: "עש",
    role: "participant",
    matchPoints: 33,
    groupRankingPoints: 0,
    bonusPoints: 6,
    totalPoints: 39,
    rank: 8,
    previousRank: 7,
    accuracyPercent: 41,
    streak: 0,
  },
];

export function participantById(id: string): Participant {
  const participant = participants.find((p) => p.id === id);
  if (!participant) throw new Error(`Unknown mock participant id: ${id}`);
  return participant;
}

export const currentParticipant = participantById(currentParticipantId);
