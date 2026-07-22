"use client";

import { motion } from "motion/react";
import { colors, motion as motionTokens } from "@/lib/design-tokens";
import { bounceIn, useReducedMotionSafe } from "@/lib/motion/variants";
import type { Participant } from "@/lib/mock/types";
import { Avatar } from "../ui";

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
  participant: Participant;
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
      transition={{ ...motionTokens.spring.soft, delay: reducedMotion ? 0 : DELAY_SECONDS[rank] }}
      className="flex flex-1 flex-col items-center gap-1.5"
    >
      {rank === 1 && (
        <span aria-hidden className="text-lg motion-safe:animate-bounce">
          👑
        </span>
      )}
      <Avatar initials={participant.avatarInitials} rank={rank} self={isSelf} size={44} />
      <span className="max-w-full truncate text-xs font-bold text-[var(--text-primary)]">
        {participant.displayName}
      </span>
      <span className="ltr text-sm font-extrabold tabular-nums" style={{ color: pointsColor }}>
        {participant.totalPoints}
      </span>
      <div
        aria-hidden
        className={`flex w-full items-end justify-center pb-1.5 text-lg ${BLOCK_HEIGHT_CLASS[rank]}`}
        style={{
          background: rank === 1 ? "linear-gradient(180deg, #D6B56E, #B89350)" : colors.surfaceCard2,
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
  topThree: Participant[];
  selfId: string;
}) {
  const byRank = (rank: number) => topThree.find((p) => p.rank === rank);
  const ordered = [byRank(2), byRank(1), byRank(3)].filter(
    (p): p is Participant => Boolean(p),
  );

  if (ordered.length === 0) return null;

  return (
    <div role="list" aria-label="הפודיום" className="flex items-end gap-2">
      {ordered.map((participant) => (
        <PodiumColumn key={participant.id} participant={participant} selfId={selfId} />
      ))}
    </div>
  );
}
