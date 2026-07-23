import "server-only";
import { headers } from "next/headers";

/**
 * Resolves the site origin from request headers for building OAuth/magic-link
 * redirect URLs inside Server Actions (which have no `window`/request URL of
 * their own). Prefers the `Origin` header Next.js sets on same-origin Server
 * Action POSTs; falls back to forwarded host/proto for platforms (e.g. Vercel)
 * that terminate TLS in front of the app.
 */
export async function getOrigin(): Promise<string> {
  const hdrs = await headers();
  const origin = hdrs.get("origin");
  if (origin) return origin;

  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  if (!host) {
    throw new Error(
      "Unable to resolve request origin (no Origin/Host header present).",
    );
  }
  return `${proto}://${host}`;
}
