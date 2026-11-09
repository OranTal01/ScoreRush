import { Avatar, RankBadge } from "../ui";
import { rankLabel } from "@/lib/scoring/race";
import type { LeaderboardParticipant } from "./types";

export function CompetitionTable({
  participants,
  selfId,
}: {
  participants: LeaderboardParticipant[];
  selfId: string;
}) {
  const leaderPoints = participants[0]?.totalPoints ?? 0;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface-card)]">
      <div className="flex justify-between gap-2 border-b border-white/10 px-4 py-3 text-xs text-[var(--text-secondary)]">
        <span>החבר׳ה · {participants.length} במרוץ</span>
        <span>שינוי / נקודות</span>
      </div>
      <ol className="divide-y divide-white/10">
        {participants.map((p) => {
          const self = p.id === selfId;
          const tied =
            participants.filter((other) => other.rank === p.rank).length > 1;
          const movement = p.previousRank - p.rank;
          return (
            <li
              key={p.id}
              id={self ? "my-standing" : undefined}
              className={`scroll-mt-28 ${self ? "bg-[var(--interactive)]/10 shadow-[inset_-3px_0_var(--interactive)]" : ""}`}
            >
              <details className="group">
                <summary className="flex min-h-20 cursor-pointer list-none items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 [&::-webkit-details-marker]:hidden">
                  <RankBadge rank={p.rank} />
                  <span className="hidden sm:block">
                    <Avatar initials={p.avatarInitials} self={self} size={32} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <bdi className="text-sm font-bold [overflow-wrap:anywhere] break-words">
                        {p.displayName}
                      </bdi>
                      {self && (
                        <span className="text-[10px] font-bold text-[var(--interactive)]">
                          אתם
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-[11px] leading-5 text-[var(--text-secondary)]">
                      {rankLabel(p.rank, tied)}
                      {p.rank !== 1
                        ? ` · ${leaderPoints - p.totalPoints} נק׳ מהפסגה`
                        : ""}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs font-bold tabular-nums ${movement > 0 ? "text-[var(--success)]" : movement < 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}
                    aria-label={
                      movement
                        ? `${movement > 0 ? "עלייה" : "ירידה"} של ${Math.abs(movement)} מקומות מאז העדכון הקודם`
                        : "ללא שינוי מהמיקום בעדכון הקודם"
                    }
                  >
                    {movement
                      ? `${movement > 0 ? "↑" : "↓"} ${Math.abs(movement)}`
                      : "—"}
                  </span>
                  <span className="min-w-12 shrink-0 text-end">
                    <strong
                      className={`block text-xl font-black tabular-nums ${self ? "text-[var(--interactive)]" : ""}`}
                    >
                      {p.totalPoints}
                    </strong>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      נקודות
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="text-xs text-[var(--text-muted)] transition-transform group-open:rotate-180"
                  >
                    ⌄
                  </span>
                </summary>
                <dl className="mx-4 mb-4 grid grid-cols-3 gap-2 rounded-xl bg-[var(--bg-page)]/50 p-3 text-center">
                  {[
                    ["משחקים", p.matchPoints],
                    ["דירוג קבוצות", p.groupRankingPoints],
                    ["בונוסים", p.bonusPoints],
                  ].map(([label, points]) => (
                    <div key={label}>
                      <dt className="text-[11px] text-[var(--text-secondary)]">
                        {label}
                      </dt>
                      <dd className="mt-1 text-base font-extrabold tabular-nums">
                        {points}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
