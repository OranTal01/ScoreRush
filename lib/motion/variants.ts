"use client";

/**
 * Central Motion (motion/react) variants + reduced-motion gate.
 * Values are sourced from lib/design-tokens.ts (motion tokens), which in
 * turn are re-derived from the Premium Fantasy Refined spec §4/§15.
 *
 * Keep all orchestrated/looping animation variants here rather than inline
 * in components, per the spec's "reusable animation variants" guidance.
 */
import { useEffect, useState } from "react";
import type { Variants } from "motion/react";
import { motion as motionTokens } from "@/lib/design-tokens";

/** Gate any animated variant through this so `prefers-reduced-motion` is honored app-wide. */
export function useReducedMotionSafe(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}

/** Default enter transition for cards/lists: fade + translateY, once per mount. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      ...motionTokens.spring.soft,
    },
  },
};

/** Bounce-in entrance used for podium-style reveals. */
export const bounceIn: Variants = {
  hidden: { opacity: 0, scale: 0.7, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      ...motionTokens.spring.soft,
    },
  },
};

/** Emphasis "pop" used for badges/points appearing. */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: motionTokens.duration.normal / 1000,
      ease: motionTokens.ease.emphasis,
    },
  },
};

/** Stagger container for list children (60ms between items). */
export const staggerParent: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: motionTokens.stagger,
    },
  },
};
