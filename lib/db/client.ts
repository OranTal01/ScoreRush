import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env/server";
import * as schema from "./schema";

/**
 * `prepare: false` is required against Supabase's pooled (pgbouncer,
 * "Transaction" mode) connection string — pgbouncer in transaction mode
 * doesn't support prepared statements across pooled connections.
 */
const client = postgres(serverEnv.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });
