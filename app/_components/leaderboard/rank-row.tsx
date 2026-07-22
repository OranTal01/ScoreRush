"use client";

import { motion } from "motion/react";
import { colors } from "@/lib/design-tokens";
import { leaderboard as content } from "@/lib/content/he";
import { rise, useReducedMotionSafe } from "@/lib/motion/variants";
import type { Participant } from "@/lib/mock/types";
import { Avatar, RankBadge } from "../ui";

function MovementIndicator({ participant }: { participant: Participant }) {
  const delta = participant.previousRank - participant.rank;
  if (delta === 0) {
    return (
      <span className="w-8 text-center text-xs font-semibold text-[var(--text-muted)]">
        {"–"}
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className="ltr flex w-8 items-center justify-center gap-0.5 text-xs font-bold tabular-nums"
      style={{ color: up ? colors.success : colors.danger }}
    >
      {up ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
}

/** One row of the full ranked list (Premium Fantasy Refined spec §6): own-row gets a
 * cyan tint + border, rows stagger in with `rise`, rank movement is never color-only
 * (arrow glyph + number, per UX-BLUEPRINT.md §7 color-independent state rule). */
export function RankRow({
  participant,
  selfId,
  index,
}: {
  participant: Participant;
  selfId: string;
  index: number;
}) {
  const reducedMotion = useReducedMotionSafe();
  const isSelf = participant.id === selfId;

  return (
    <motion.li
      initial={reducedMotion ? "visible" : "hidden"}
      animate="visible"
      variants={rise}
      transition={{ delay: reducedMotion ? 0 : index * 0.06 }}
      className="flex items-center gap-2.5 px-2.5 py-2"
      style={{
        borderRadius: "var(--radius-row)",
        background: isSelf ? "rgba(95,168,211,0.10)" : "transparent",
        border: `1px solid ${isSelf ? "rgba(95,168,211,0.35)" : "transparent"}`,
      }}
    >
      <RankBadge rank={participant.rank} />
      <Avatar initials={participant.avatarInitials} self={isSelf} size={32} />
      <span className="flex flex-1 items-baseline gap-1.5 truncate">
        <span className="truncate text-sm font-bold text-[var(--text-primary)]">
          {participant.displayName}
        </span>
        {isSelf && (
          <span className="text-[10.5px] font-semibold text-[var(--interactive)]">
            ({content.yourRow})
          </span>
        )}
      </span>
      <MovementIndicator participant={participant} />
      <span
        className="ltr w-9 shrink-0 text-end text-sm font-extrabold tabular-nums"
        style={{ color: isSelf ? colors.interactive : colors.textPrimary }}
      >
        {participant.totalPoints}
      </span>
    </motion.li>
  );
}
