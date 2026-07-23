/**
 * Client-safe environment variables — validated once at import time so a
 * missing/malformed value fails loudly at startup instead of surfacing as a
 * confusing runtime error deep inside a Supabase call. Only `NEXT_PUBLIC_*`
 * variables belong here; anything secret goes in `lib/env/server.ts`
 * (ARCHITECTURE.md §11: "server-side only, never logged").
 */
import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  throw new Error(
    `Invalid public environment variables:\n${parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")}\n\nSee .env.local.example for what's required.`,
  );
}

export const publicEnv = parsed.data;
