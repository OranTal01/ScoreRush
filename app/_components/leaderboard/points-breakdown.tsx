import { leaderboard as content } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import { RankBadge } from "../ui";
import type { LeaderboardParticipant } from "./types";

/**
 * Participant comparison view (ROADMAP.md Phase 6). All participants side
 * by side with their matchPoints/groupRankingPoints/bonusPoints columns
 * visibly summing to the totalPoints column shown on the podium/ranked list
 * — the same numbers, the same `computeStandings` output, just broken down.
 * Directly demonstrates SCORING-RULES.md §9's "totalPoints = matchPoints +
 * groupRankingPoints + bonusPoints, always" — the leaderboard and this
 * breakdown can never disagree because both are read off one `standings`
 * array computed once in page.tsx.
 */
export function PointsBreakdown({
  participants,
  selfId,
}: {
  participants: LeaderboardParticipant[];
  selfId: string;
}) {
  if (participants.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10.5px] font-semibold text-[var(--text-muted)]">
            <th className="py-1 text-start font-semibold">
              {content.breakdownParticipantHeader}
            </th>
            <th className="py-1 text-center font-semibold">
              {content.matchPointsLabel}
            </th>
            <th className="py-1 text-center font-semibold">
              {content.groupRankingPointsLabel}
            </th>
            <th className="py-1 text-center font-semibold">
              {content.bonusPointsLabel}
            </th>
            <th className="py-1 text-center font-semibold">
              {content.totalPointsLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {participants.map((participant) => {
            const isSelf = participant.id === selfId;
            return (
              <tr
                key={participant.id}
                className="border-t"
                style={{
                  borderColor: colors.border,
                  background: isSelf ? "rgba(95,168,211,0.10)" : "transparent",
                }}
              >
                <td className="py-2">
                  <span className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                    <RankBadge rank={participant.rank} />
                    <span className="truncate">{participant.displayName}</span>
                  </span>
                </td>
                <td className="ltr py-2 text-center text-[var(--text-secondary)] tabular-nums">
                  {participant.matchPoints}
                </td>
                <td className="ltr py-2 text-center text-[var(--text-secondary)] tabular-nums">
                  {participant.groupRankingPoints}
                </td>
                <td className="ltr py-2 text-center text-[var(--text-secondary)] tabular-nums">
                  {participant.bonusPoints}
                </td>
                <td
                  className="ltr py-2 text-center font-extrabold tabular-nums"
                  style={{ color: isSelf ? colors.interactive : colors.textPrimary }}
                >
                  {participant.totalPoints}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
