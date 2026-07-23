/**
 * Only ever forward same-origin relative paths as a post-login redirect
 * target — never an absolute/external URL, which would make `next` an open
 * redirect. Used everywhere a `next` value crosses a trust boundary (login
 * page query string, magic-link/OAuth redirect construction, the
 * `/auth/callback` handler).
 */
export function sanitizeNext(value: string | null | undefined): string {
  if (!value) return "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
