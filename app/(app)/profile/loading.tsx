import { common } from "@/lib/content/he";
import { Card, Skeleton } from "../../_components/ui";

/**
 * Route-level Suspense fallback for the profile screen (Phase 9 #72). See
 * app/(app)/loading.tsx's doc comment for why this exists; outer container
 * mirrors the real page's `md:max-w-[480px]`, four cards mirror the real
 * page's hero / rank-history / achievements / linked-tournaments sections.
 */
export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[480px]">
      <span role="status" aria-live="polite" className="sr-only">
        {common.loading}
      </span>
      <Card padding="hero">
        <Skeleton className="h-56 w-full" />
      </Card>
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <Skeleton className="h-16 w-full" />
        </Card>
      ))}
    </div>
  );
}
