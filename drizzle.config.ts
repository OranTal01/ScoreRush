import { defineConfig } from "drizzle-kit";

// Intentionally reads process.env directly (not lib/env/server.ts) — this
// file runs under drizzle-kit's own Node process, outside the Next.js
// runtime, and must stay usable even if the app's server-only env module
// changes shape.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required to run drizzle-kit. See .env.local.example.",
  );
}

export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  schemaFilter: ["public"],
});
