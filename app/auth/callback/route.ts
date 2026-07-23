import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNext } from "@/lib/auth/sanitize-next";

/**
 * Single callback for both Google OAuth and magic-link sign-in
 * (ARCHITECTURE.md §4) — @supabase/ssr defaults to the PKCE flow for both,
 * so both redirect here with a `?code=` param that gets exchanged for a
 * session cookie. `public.users` row provisioning happens server-side via
 * the `on_auth_user_created` trigger (lib/db/migrations/0001_rls_policies.sql),
 * not here.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const safeNext = sanitizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Behind a reverse proxy (Vercel), prefer the forwarded host so the
      // redirect lands on the public URL rather than an internal one.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const forwardedProto =
        request.headers.get("x-forwarded-proto") ?? "https";
      const redirectOrigin = forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : origin;
      return NextResponse.redirect(`${redirectOrigin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback`);
}
