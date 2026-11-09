"use client";

import { motion } from "motion/react";
import { colors, motion as motionTokens } from "@/lib/design-tokens";
import { bounceIn, useReducedMotionSafe } from "@/lib/motion/variants";
import { Avatar } from "../ui";
import type { LeaderboardParticipant } from "./types";
import { rankLabel } from "@/lib/scoring/race";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const BLOCK_HEIGHT_CLASS: Record<number, string> = {
  1: "h-[72px] md:h-[66px]",
  2: "h-[52px] md:h-[48px]",
  3: "h-[42px] md:h-[38px]",
};
/** Podium reveal order: 1st rises first, then silver at 150ms, then bronze at 300ms
 * (Premium Fantasy Refined spec §6), while the visual column order stays silver–gold–bronze. */
const DELAY_SECONDS: Record<number, number> = { 1: 0, 2: 0.15, 3: 0.3 };

function PodiumColumn({
  participant,
  selfId,
}: {
  participant: LeaderboardParticipant;
  selfId: string;
}) {
  const reducedMotion = useReducedMotionSafe();
  const isSelf = participant.id === selfId;
  const rank = participant.rank;
  const pointsColor =
    rank === 1 ? colors.gold : rank === 2 ? colors.silver : colors.bronze;

  return (
    <motion.div
      role="listitem"
      initial={reducedMotion ? "visible" : "hidden"}
      animate="visible"
      variants={bounceIn}
      transition={{
        ...motionTokens.spring.soft,
        delay: reducedMotion ? 0 : DELAY_SECONDS[rank],
      }}
      className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
    >
      {rank === 1 && (
        <span aria-hidden className="text-lg">
          👑
        </span>
      )}
      <Avatar
        initials={participant.avatarInitials}
        rank={rank}
        self={isSelf}
        size={44}
      />
      <span className="max-w-full text-center text-xs font-bold [overflow-wrap:anywhere] break-words text-[var(--text-primary)]">
        {participant.displayName}
      </span>
      <span
        className="ltr text-sm font-extrabold tabular-nums"
        style={{ color: pointsColor }}
      >
        {participant.totalPoints}
      </span>
      <div
        aria-hidden
        className={`flex w-full items-end justify-center pb-1.5 text-lg ${BLOCK_HEIGHT_CLASS[rank]}`}
        style={{
          background:
            rank === 1
              ? "linear-gradient(180deg, #D6B56E, #B89350)"
              : colors.surfaceCard2,
          borderRadius: "12px 12px 0 0",
        }}
      >
        {MEDAL[rank]}
      </div>
    </motion.div>
  );
}

/** Top-3 podium — Premium Fantasy Refined spec §6: gold column tallest and centered,
 * silver/bronze flank it regardless of text direction (array order fixes visual position). */
export function Podium({
  topThree,
  selfId,
}: {
  topThree: LeaderboardParticipant[];
  selfId: string;
}) {
  const hasTie = new Set(topThree.map((p) => p.rank)).size < topThree.length;
  const ordered = hasTie
    ? topThree
    : [topThree[1], topThree[0], topThree[2]].filter(
        (p): p is LeaderboardParticipant => Boolean(p),
      );

  if (ordered.length === 0) return null;

  if (topThree.length > 3) {
    return (
      <div className="flex flex-col gap-4" role="list" aria-label="הפודיום">
        {[1, 2, 3].map((rank) => {
          const members = topThree.filter((p) => p.rank === rank);
          if (!members.length) return null;
          return (
            <div key={rank}>
              <p className="mb-2 text-xs font-bold text-[var(--gold)]">
                {MEDAL[rank]} {rankLabel(rank, members.length > 1)} ·{" "}
                {members[0].totalPoints} נק׳
              </p>
              <div className="flex flex-wrap gap-2">
                {members.map((p) => (
                  <div
                    role="listitem"
                    key={p.id}
                    className={`max-w-full min-w-0 rounded-xl border px-3 py-2 text-sm font-semibold [overflow-wrap:anywhere] ${p.id === selfId ? "border-[var(--interactive)]/40 bg-[var(--interactive)]/10" : "border-white/10 bg-white/5"}`}
                  >
                    <bdi>{p.displayName}</bdi>
                    {p.id === selfId && (
                      <span className="ms-2 text-xs text-[var(--interactive)]">
                        אתם
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div role="list" aria-label="הפודיום" className="flex items-end gap-2">
      {ordered.map((participant) => (
        <PodiumColumn
          key={participant.id}
          participant={participant}
          selfId={selfId}
        />
      ))}
    </div>
  );
}
