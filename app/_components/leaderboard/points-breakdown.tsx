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
    <>
      <div className="space-y-3 sm:hidden">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="rounded-xl border border-[var(--border)] p-3"
            style={{
              background:
                participant.id === selfId
                  ? "rgba(95,168,211,0.10)"
                  : "transparent",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
                <RankBadge rank={participant.rank} />
                <bdi className="truncate">{participant.displayName}</bdi>
              </span>
              <span className="shrink-0 text-sm font-extrabold text-[var(--interactive)]">
                {participant.totalPoints} נק׳
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3 text-center">
              {[
                [content.matchPointsLabel, participant.matchPoints],
                [
                  content.groupRankingPointsLabel,
                  participant.groupRankingPoints,
                ],
                [content.bonusPointsLabel, participant.bonusPoints],
              ].map(([label, points]) => (
                <div key={label}>
                  <dt className="text-[11px] text-[var(--text-muted)]">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-bold tabular-nums">
                    {points}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div
        className="hidden overflow-x-auto rounded-xl sm:block"
        role="region"
        aria-label="פירוט הנקודות — ניתן לגלול אופקית"
        tabIndex={0}
      >
        <table className="w-full min-w-[380px] text-xs [&_td]:px-2 [&_td]:py-3 [&_th]:px-2 [&_th]:py-3">
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
                    background: isSelf
                      ? "rgba(95,168,211,0.10)"
                      : "transparent",
                  }}
                >
                  <td className="py-2">
                    <span className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                      <RankBadge rank={participant.rank} />
                      <bdi className="max-w-40 truncate">
                        {participant.displayName}
                      </bdi>
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
                    style={{
                      color: isSelf ? colors.interactive : colors.textPrimary,
                    }}
                  >
                    {participant.totalPoints}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
