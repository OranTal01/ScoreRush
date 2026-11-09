import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
export async function fillMissingPredictions(tournamentId: string) {
  await db.execute(sql`select public.fill_missing_predictions(${tournamentId}::uuid)`);
}
