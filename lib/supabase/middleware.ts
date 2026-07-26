import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env/public";

/**
 * Refreshes the Supabase auth session cookie on every request. Required
 * because Server Components can't write cookies themselves (see the catch
 * block in lib/supabase/server.ts) — without this, sessions would silently
 * stop refreshing and users would be logged out unpredictably.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not add logic between createServerClient and getUser().
  // A stray early return here can make session refresh silently stop
  // working, which manifests as users randomly getting logged out.
  //
  // getUser() itself is wrapped in try/catch (Phase 9 #73 — offline/error
  // state pass): this runs on essentially every request site-wide
  // (proxy.ts's matcher), and previously an unhandled rejection here (a
  // Supabase outage or DNS/network failure, not just "no session") would
  // propagate uncaught and 500 the entire site for every visitor until
  // Supabase recovered. Failing closed to "no user" on a thrown error is
  // the same outcome proxy.ts already produces for a genuinely missing
  // session — redirect to /login — which is the safe default when we can't
  // verify the session either way.
  let user = null;
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser();
    user = fetchedUser;
  } catch {
    user = null;
  }

  return { supabaseResponse, user };
}
