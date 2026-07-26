"use client";

/**
 * Count-up hook per the Premium Fantasy Refined spec §5: "Count-up from
 * 0 -> 247, duration 900ms, easing = cubic-out (1-(1-p)^3), requestAnimationFrame."
 * Animates on first mount and again whenever `value` changes (e.g. points
 * increase after a scored match), tweening from the *previous* displayed
 * value rather than always restarting from zero. Reduced motion: the value
 * jumps straight to its final state, no animation frames scheduled at all.
 */
import { useEffect, useRef, useState } from "react";

export function useCountUp(
  value: number,
  reducedMotion: boolean,
  durationMs = 900,
): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reducedMotion) {
      // No animation frames when reduced motion is on — `value` is returned
      // directly below (derived during render), so there's nothing to
      // schedule here beyond keeping `fromRef` in sync for if/when reduced
      // motion is toggled off later.
      fromRef.current = value;
      return;
    }

    const from = fromRef.current;
    const delta = value - from;
    if (delta === 0) return;

    const start = performance.now();
    let frame: number;

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + delta * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reducedMotion, durationMs]);

  return reducedMotion ? value : display;
}
