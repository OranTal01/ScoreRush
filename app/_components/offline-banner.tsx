"use client";

import { useEffect, useState } from "react";
import { common } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";

type Status = "online" | "offline" | "justBackOnline";

/**
 * Site-wide connectivity banner (Phase 9 #73 — offline/loading/error state
 * pass). Rendered once in the root layout, above `{children}`, so it covers
 * every route including `/login` and `/join` (not just the authenticated
 * `(app)` group). Reads `navigator.onLine` plus the `online`/`offline`
 * window events — a heuristic (it reflects the network interface, not
 * "can actually reach Supabase"), but it's the standard signal for this
 * kind of banner and matches what `common.offline`'s copy already implies
 * ("showing last-saved data", not "we verified connectivity").
 *
 * z-50 matches the highest existing z-index in the app (the tournament
 * switcher's dropdown panel) so the banner is never hidden behind the
 * sticky header/bottom-nav (both z-30/z-40) whenever it's visible.
 *
 * The initial status is read via a `useState` lazy initializer (guarded for
 * SSR, since `navigator` doesn't exist on the server) rather than set
 * synchronously inside the effect body — same pattern already used by
 * `lib/motion/variants.ts`'s `useReducedMotionSafe` for
 * `matchMedia`-derived initial state. The effect below only subscribes to
 * *changes*; it never calls `setState` synchronously itself, so it doesn't
 * trip `react-hooks/set-state-in-effect`.
 *
 * The "back online" state auto-dismisses after 3s via a `setTimeout` inside
 * a second `useEffect` — same pattern already used by
 * `lib/motion/use-count-up.ts` (setState inside an async callback, not
 * synchronously in the effect body).
 */
export function OfflineBanner() {
  const [status, setStatus] = useState<Status>(() =>
    typeof navigator === "undefined" || navigator.onLine ? "online" : "offline",
  );

  useEffect(() => {
    function handleOffline() {
      setStatus("offline");
    }
    function handleOnline() {
      setStatus("justBackOnline");
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    if (status !== "justBackOnline") return;
    const timer = setTimeout(() => setStatus("online"), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  if (status === "online") return null;

  const isOffline = status === "offline";

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 px-4 py-2 text-center text-xs font-semibold"
      style={{
        background: isOffline ? colors.danger : colors.success,
        color: colors.textPrimary,
      }}
    >
      {isOffline ? common.offline : common.backOnline}
    </div>
  );
}
