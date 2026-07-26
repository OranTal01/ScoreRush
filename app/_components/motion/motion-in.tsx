"use client";

/**
 * Generic entrance-motion wrapper (Phase 9 gap-fill, ROADMAP.md "full
 * motion/animation parity pass"). Mirrors the exact convention already
 * established by `RankRow`/`Podium` (app/_components/leaderboard/): mount +
 * index-based stagger delay, gated through `useReducedMotionSafe`, variants
 * sourced from `lib/motion/variants.ts`. This just generalizes that pattern
 * so every card/list-row across the app (not only the leaderboard) can use
 * the same entrance without hand-rolling `motion.div` boilerplate per site.
 *
 * `index` drives a 60ms stagger (spec §4 "Stagger: list children 0.06s
 * between items") — pass the item's position for list rows, or an
 * ascending per-section index for a page's stacked cards so they cascade
 * in top-to-bottom on first paint.
 */
import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import type { Variants } from "motion/react";
import {
  bounceIn,
  pop,
  rise,
  useReducedMotionSafe,
} from "@/lib/motion/variants";

const VARIANTS: Record<"rise" | "pop" | "bounceIn", Variants> = {
  rise,
  pop,
  bounceIn,
};

export function MotionIn({
  children,
  index = 0,
  variant = "rise",
  as = "div",
  className,
  style,
}: {
  children: ReactNode;
  index?: number;
  variant?: "rise" | "pop" | "bounceIn";
  as?: "div" | "li" | "span";
  className?: string;
  style?: CSSProperties;
}) {
  const reducedMotion = useReducedMotionSafe();
  const MotionTag =
    as === "li" ? motion.li : as === "span" ? motion.span : motion.div;

  return (
    <MotionTag
      initial={reducedMotion ? "visible" : "hidden"}
      animate="visible"
      variants={VARIANTS[variant]}
      transition={{ delay: reducedMotion ? 0 : index * 0.06 }}
      className={className}
      style={style}
    >
      {children}
    </MotionTag>
  );
}
