import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tournamentProviders } from "@/lib/db/schema/config";
import { liveRuntime } from "@/lib/db/schema/live";
export async function getLiveAccess(tournamentId: string) {
  const [row] = await db
    .select({ access: liveRuntime.access })
    .from(tournamentProviders)
    .leftJoin(
      liveRuntime,
      eq(liveRuntime.provider, tournamentProviders.matchDataProvider),
    )
    .where(eq(tournamentProviders.tournamentId, tournamentId));
  return row?.access ?? "delayed";
}
