import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env/public";

/**
 * Supabase client for use inside Server Components, Server Actions, and
 * Route Handlers — reads/writes the session via Next.js's cookie store.
 * Must be created fresh per request (never module-level singleton), per
 * the official @supabase/ssr Next.js App Router pattern.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render — cookies can't be
            // written there. Harmless as long as proxy.ts is also
            // refreshing the session on every request (see
            // lib/supabase/middleware.ts).
          }
        },
      },
    },
  );
}
