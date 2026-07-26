"use client";

import { useEffect } from "react";
import { common } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";

/**
 * Route-segment error boundary (Phase 9 #73 — offline/loading/error state
 * pass). Next.js wraps every segment below the root layout in the nearest
 * `error.tsx` automatically — this is the site-wide catch net for any
 * thrown error in a Server or Client Component render (previously there
 * was none anywhere in the app, so a thrown error fell through to Next's
 * generic unstyled error screen). Must be a Client Component per the
 * framework contract (`error.tsx` receives `reset` to retry the segment
 * without a full page reload). Deliberately doesn't try to distinguish
 * error *kinds* (network vs RLS vs bug) — see lib/supabase error-handling
 * scoping note in the #73 commit message for why per-query error surfacing
 * was evaluated and left for a follow-up.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div
        role="alert"
        className="flex flex-col items-center gap-3 border border-dashed px-6 py-10"
        style={{
          borderColor: colors.border,
          borderRadius: "var(--radius-card)",
          maxWidth: 360,
        }}
      >
        <span aria-hidden className="text-2xl">
          ⚠️
        </span>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {common.errorGeneric}
        </p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-3.5 text-xs font-bold text-[var(--text-primary)]"
          style={{
            background: colors.surfaceCard2,
            borderRadius: "var(--radius-button)",
          }}
        >
          {common.retry}
        </button>
      </div>
    </div>
  );
}
