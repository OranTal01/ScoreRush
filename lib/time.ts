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
