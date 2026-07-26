import { common } from "@/lib/content/he";
import { Card, Skeleton } from "@/app/_components/ui";

/**
 * Route-level Suspense fallback for the match detail / prediction-entry
 * screen (Phase 9 #72). See app/(app)/loading.tsx's doc comment for why
 * this exists; outer container mirrors the real page's `md:max-w-[480px]`.
 */
export default function MatchDetailLoading() {
  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[480px]">
      <span role="status" aria-live="polite" className="sr-only">
        {common.loading}
      </span>
      <Skeleton className="h-4 w-24" />
      <Card padding="hero">
        <Skeleton className="h-52 w-full" />
      </Card>
    </div>
  );
}
