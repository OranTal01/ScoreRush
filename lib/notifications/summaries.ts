import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tournamentDigests } from "@/lib/db/schema/push";

/** Caller must resolve tournament membership before reading private summaries. */
export async function readSummaries(tournamentId: string, limit = 15) {
  return db
    .select()
    .from(tournamentDigests)
    .where(
      and(
        eq(tournamentDigests.tournamentId, tournamentId),
        isNotNull(tournamentDigests.publishedAt),
      ),
    )
    .orderBy(desc(tournamentDigests.day))
    .limit(limit);
}
