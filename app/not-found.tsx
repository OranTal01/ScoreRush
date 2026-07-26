import Link from "next/link";
import { common } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";

/**
 * Site-wide 404 (Phase 9 #73). Fires for any unmatched route, and for any
 * in-app `notFound()` call (predictions/[matchId], admin overrides/
 * diagnostics detail pages) that doesn't have a more specific not-found.tsx
 * of its own — none of those routes define one, so this is the single
 * catch-all today. Plain Server Component; no interactivity needed.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div
        className="flex flex-col items-center gap-3 border border-dashed px-6 py-10"
        style={{
          borderColor: colors.border,
          borderRadius: "var(--radius-card)",
          maxWidth: 360,
        }}
      >
        <span aria-hidden className="text-2xl">
          🔍
        </span>
        <p className="text-sm font-bold text-[var(--text-primary)]">
          {common.pageNotFoundTitle}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          {common.pageNotFoundBody}
        </p>
        <Link
          href="/"
          className="px-4 py-3.5 text-xs font-bold text-[var(--text-primary)]"
          style={{
            background: colors.surfaceCard2,
            borderRadius: "var(--radius-button)",
          }}
        >
          {common.backToHome}
        </Link>
      </div>
    </div>
  );
}
