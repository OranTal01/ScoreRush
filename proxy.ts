import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Routes reachable while signed out. ARCHITECTURE.md §4: account creation
 * (identity) is separate from tournament membership, but every screen still
 * requires *some* identity — there's no anonymous browsing mode. `/join` is
 * the one deliberate exception: an invitation link shared before the
 * recipient has an account must resolve to a tournament preview, not a
 * bounce straight to /login (UX-BLUEPRINT.md §3 screen 3).
 *
 * `/api/cron` is a second, different exception: Vercel Cron (and any
 * authorized external pinger, ARCHITECTURE.md §7) calls these routes with no
 * Supabase session at all — they authenticate via a `CRON_SECRET` bearer
 * token checked inside the route handler itself, not via cookies. Redirecting
 * them to /login here would make the sync job unreachable regardless of
 * whether the caller presents a valid secret. Only `/api/cron`, not all of
 * `/api`, is public this way — future participant-facing API routes should
 * stay session-gated by default.
 */
const PUBLIC_PATH_PREFIXES = ["/login", "/auth", "/join", "/api/cron"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Carries the session cookies `updateSession` just refreshed onto a redirect
 * response — `NextResponse.redirect()` starts a brand-new response and would
 * otherwise silently drop them, causing an extra redirect loop on the next
 * request.
 */
function withRefreshedCookies(
  redirectResponse: NextResponse,
  supabaseResponse: NextResponse,
): NextResponse {
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

// Renamed from the legacy `middleware` file convention per Next.js 16
// (https://nextjs.org/docs/messages/middleware-to-proxy) — same runtime
// behavior, new file/export name.
export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return withRefreshedCookies(NextResponse.redirect(url), supabaseResponse);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return withRefreshedCookies(NextResponse.redirect(url), supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - static image assets
     * Adjust if a route needs to explicitly opt out of session refresh.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
