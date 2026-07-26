import { common } from "@/lib/content/he";
import { SubTabs } from "../../_components/nav/sub-tabs";
import { Card, Skeleton } from "../../_components/ui";

/**
 * Route-level Suspense fallback for the groups screen (Phase 9 #72). See
 * app/(app)/loading.tsx's doc comment for why this exists; renders the real
 * `SubTabs` (no data fetch of its own) so tournament-structure nav stays
 * interactive immediately, matching the real page's `Shell` wrapper.
 */
export default function GroupsLoading() {
  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[560px] lg:max-w-[640px]">
      <span role="status" aria-live="polite" className="sr-only">
        {common.loading}
      </span>
      <SubTabs />
      {[0, 1].map((i) => (
        <Card key={i}>
          <Skeleton className="h-40 w-full" />
        </Card>
      ))}
    </div>
  );
}
