"use client";

import { motion } from "motion/react";
import { rise, useReducedMotionSafe } from "@/lib/motion/variants";

/**
 * Minimal proof that the Motion pipeline + reduced-motion gate work end to
 * end. Not a real product component — Phase 2 builds the actual screens.
 */
export function RiseDemo() {
  const reducedMotion = useReducedMotionSafe();

  return (
    <motion.div
      initial={reducedMotion ? "visible" : "hidden"}
      animate="visible"
      variants={rise}
      className="rounded-card border border-[var(--border)] bg-[var(--surface-card)] p-4"
      style={{ borderRadius: "var(--radius-card)" }}
    >
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        כרטיס זה נכנס עם אנימציית <span className="ltr">rise</span>{" "}
        (spring.soft), ומכבד <span className="ltr">prefers-reduced-motion</span>
        .
      </p>
    </motion.div>
  );
}
