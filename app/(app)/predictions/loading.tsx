import { common } from "@/lib/content/he";
import { SubTabs } from "../../_components/nav/sub-tabs";
import { Card, Skeleton } from "../../_components/ui";

/**
 * Route-level Suspense fallback for the predictions (match list) screen
 * (Phase 9 #72). See app/(app)/loading.tsx's doc comment for why this
 * exists; outer container mirrors the real page's
 * `md:max-w-[560px] lg:max-w-[640px]` so swapping in real content doesn't
 * shift layout. Renders the real `SubTabs` (it doesn't fetch data — just
 * `usePathname`) instead of a skeleton block so tournament-structure nav
 * stays interactive immediately, matching the other two SubTabs-bearing
 * screens (groups, bracket).
 */
export default function PredictionsLoading() {
  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[560px] lg:max-w-[640px]">
      <span role="status" aria-live="polite" className="sr-only">
        {common.loading}
      </span>
      <SubTabs />
      {[0, 1, 2, 3].map((i) => (
        <Card key={i}>
          <Skeleton className="h-24 w-full" />
        </Card>
      ))}
    </div>
  );
}
