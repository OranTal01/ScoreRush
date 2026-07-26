import { common } from "@/lib/content/he";
import { SubTabs } from "../../_components/nav/sub-tabs";
import { Card, Skeleton } from "../../_components/ui";

/**
 * Route-level Suspense fallback for the bracket screen (Phase 9 #72). See
 * app/(app)/loading.tsx's doc comment for why this exists; outer container
 * mirrors the real page's `md:max-w-[720px]`, renders the real `SubTabs`
 * (no data fetch of its own) so tournament-structure nav stays interactive
 * immediately.
 */
export default function BracketLoading() {
  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[720px]">
      <span role="status" aria-live="polite" className="sr-only">
        {common.loading}
      </span>
      <SubTabs />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <Card className="flex-1">
          <Skeleton className="h-40 w-full" />
        </Card>
        <Card className="flex-1">
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    </div>
  );
}
