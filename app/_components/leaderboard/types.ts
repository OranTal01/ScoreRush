/**
 * Minimal participant shape `Podium`/`RankRow` actually render. Deliberately
 * decoupled from `lib/mock/types.Participant` — that type also carries
 * Phase-2-mock-only stats (accuracyPercent, streak, role) that have no
 * column in the real schema (DATABASE.md §2) and Phase 6's real leaderboard
 * screen (app/(app)/leaderboard/page.tsx) has no honest value to fill them
 * with.
 */
export interface LeaderboardParticipant {
  id: string;
  displayName: string;
  avatarInitials: string;
  totalPoints: number;
  rank: number;
  previousRank: number;
}
