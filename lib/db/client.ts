import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env/server";
import * as schema from "./schema";
import { runtimeDatabaseUrl } from "./connection";

/**
 * `prepare: false` is required against Supabase's pooled (pgbouncer,
 * "Transaction" mode) connection string — pgbouncer in transaction mode
 * doesn't support prepared statements across pooled connections.
 */
const connection = runtimeDatabaseUrl(serverEnv.DATABASE_URL);
const client = postgres(connection, {
  prepare: false,
  max: 1,
  idle_timeout: 10,
  max_lifetime: 60,
  connect_timeout: 15,
  ...(new URL(connection).hostname.endsWith(".supabase.com")
    ? { ssl: "require" as const }
    : {}),
});

export const db = drizzle(client, { schema });
