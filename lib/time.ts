/**
 * Shared "has this timestamp passed" check for every lock-time comparison
 * in the app (match `lock_time`, bonus `locks_at`, ...) — kept in one place
 * so the semantics always match the RLS backstop (`now() >= lock_time` /
 * `now() >= locks_at`, lib/db/migrations/0001_rls_policies.sql), and so the
 * live `Date.now()` read happens in a plain function rather than directly
 * inside a component body (react-hooks/purity flags impure calls made
 * directly during render).
 */
export function isPast(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

export function currentTimeMs(): number {
  return Date.now();
}

/** Explicit timezone keeps server-rendered kickoffs and deadlines consistent
 * with the Hebrew UI, including Israel's summer/winter clock changes. */
export function formatMatchTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
