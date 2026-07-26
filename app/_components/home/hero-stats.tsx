"use client";

/**
 * Animated pieces of the home dashboard's rank hero (Phase 9 gap-fill,
 * ROADMAP.md "full motion/animation parity pass"), matching Premium Fantasy
 * Refined spec §5 as closely as a server-rendered-by-default screen allows:
 * - Rank number: fade+scale entrance (`{opacity:[0,1], scale:[0.8,1]}`,
 *   --motion-slow, --ease-emphasis, delay 120ms). No per-digit odometer —
 *   spec explicitly says "single digit" (this app's ranks are also always
 *   rendered as a plain integer, never split into digits).
 * - Total points: count-up from the previously-displayed value to the new
 *   one (0 on first mount), 900ms cubic-out, via `useCountUp`.
 * - Rank-movement chip: `{opacity:[0,1], y:[-6,0]}`, --motion-normal,
 *   --ease-out, delay 200ms.
 * All three honor `prefers-reduced-motion` independently through
 * `useReducedMotionSafe` (jumps straight to final state, no animation).
 */
import { motion } from "motion/react";
import { motion as motionTokens, typography } from "@/lib/design-tokens";
import { common, scoring } from "@/lib/content/he";
import { useCountUp } from "@/lib/motion/use-count-up";
import { useReducedMotionSafe } from "@/lib/motion/variants";
import { Pill } from "../ui";

export function HeroRankNumber({ rank }: { rank: number }) {
  const reducedMotion = useReducedMotionSafe();
  return (
    <motion.span
      className="ltr text-[var(--gold)] tabular-nums"
      style={{
        fontSize: typography.scale.heroRankNumber.mobile,
        fontWeight: typography.scale.heroRankNumber.weight,
        lineHeight: typography.scale.heroRankNumber.lineHeight,
      }}
      initial={
        reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }
      }
      animate={{ opacity: 1, scale: 1 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              duration: motionTokens.duration.slow / 1000,
              ease: motionTokens.ease.emphasis,
              delay: 0.12,
            }
      }
    >
      {rank}
    </motion.span>
  );
}

export function HeroPointsCounter({ points }: { points: number }) {
  const reducedMotion = useReducedMotionSafe();
  const display = useCountUp(points, reducedMotion);
  return (
    <>
      <span
        aria-hidden="true"
        className="ltr text-[var(--text-primary)] tabular-nums"
        style={{
          fontSize: typography.scale.heroTotalPoints.mobile,
          fontWeight: typography.scale.heroTotalPoints.weight,
          lineHeight: typography.scale.heroTotalPoints.lineHeight,
        }}
      >
        {display}
      </span>
      <span className="sr-only" aria-live="polite">
        {points} {common.points}
      </span>
    </>
  );
}

export function RankMovementChip({ rankMoved }: { rankMoved: number }) {
  const reducedMotion = useReducedMotionSafe();
  if (rankMoved === 0) return null;
  return (
    <motion.div
      initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              duration: motionTokens.duration.normal / 1000,
              ease: motionTokens.ease.out,
              delay: 0.2,
            }
      }
    >
      <Pill tone={rankMoved > 0 ? "success" : "danger"}>
        {rankMoved > 0 ? scoring.rankUp : scoring.rankDown} ·{" "}
        {Math.abs(rankMoved)} מקומות
      </Pill>
    </motion.div>
  );
}
