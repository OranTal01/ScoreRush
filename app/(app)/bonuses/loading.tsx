import { common } from "@/lib/content/he";
import { Card, Skeleton } from "../../_components/ui";

/**
 * Route-level Suspense fallback for the bonuses screen (Phase 9 #72). See
 * app/(app)/loading.tsx's doc comment for why this exists; outer container
 * mirrors the real page's `md:max-w-[560px] lg:max-w-[640px]`.
 */
export default function BonusesLoading() {
  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[560px] lg:max-w-[640px]">
      <span role="status" aria-live="polite" className="sr-only">
        {common.loading}
      </span>
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <Skeleton className="h-28 w-full" />
        </Card>
      ))}
    </div>
  );
}
