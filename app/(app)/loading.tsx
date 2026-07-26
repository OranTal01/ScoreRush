import { common } from "@/lib/content/he";
import { spacing } from "@/lib/design-tokens";
import { Card, Skeleton } from "../_components/ui";

/**
 * Route-level Suspense fallback for the home dashboard (Phase 9 #72
 * performance pass). Next.js automatically wraps `page.tsx` in a Suspense
 * boundary whenever a sibling `loading.tsx` exists, so this renders
 * immediately — on cold loads once the shared app-shell layout resolves,
 * and on every client-side nav into "/" — while the page's ~4 parallel
 * Supabase queries are still in flight. Mirrors the real page's outer
 * container class exactly (Phase 9 #74 responsive review moved the grid
 * from `md:` to `lg:` — single column with a centered, wider cap through
 * the tablet band, grid only from `lg:` — see page.tsx's comment) so
 * swapping in real content doesn't shift layout at any breakpoint.
 */
export default function HomeLoading() {
  return (
    <div
      className="mx-auto flex w-full flex-col gap-4 md:max-w-[640px] lg:grid lg:max-w-none lg:grid-cols-[340px_1fr_360px] lg:items-start"
      style={{ gap: spacing.desktopGutter }}
    >
      <span role="status" aria-live="polite" className="sr-only">
        {common.loading}
      </span>
      <div className="flex flex-col gap-4">
        <Card padding="hero">
          <Skeleton className="h-40 w-full" />
        </Card>
        <Card>
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Card>
          <Skeleton className="h-32 w-full" />
        </Card>
        <Card>
          <Skeleton className="h-32 w-full" />
        </Card>
      </div>
    </div>
  );
}
