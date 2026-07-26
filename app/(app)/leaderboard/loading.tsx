import { common } from "@/lib/content/he";
import { Card, Skeleton } from "../../_components/ui";

/**
 * Route-level Suspense fallback for the leaderboard screen (Phase 9 #72).
 * See app/(app)/loading.tsx's doc comment for why this exists; three
 * skeleton cards mirror the real page's podium / ranked-list / breakdown
 * sections and outer `md:max-w-[560px] lg:max-w-[640px]` container.
 */
export default function LeaderboardLoading() {
  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[560px] lg:max-w-[640px]">
      <span role="status" aria-live="polite" className="sr-only">
        {common.loading}
      </span>
      <Card>
        <Skeleton className="h-32 w-full" />
      </Card>
      <Card>
        <Skeleton className="h-48 w-full" />
      </Card>
      <Card>
        <Skeleton className="h-24 w-full" />
      </Card>
    </div>
  );
}
