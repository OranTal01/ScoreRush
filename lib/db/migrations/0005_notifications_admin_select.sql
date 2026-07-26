-- Adds admin visibility to `notifications`, mirroring `sync_logs_select_admin`
-- and `score_audit_logs_select_admin` (0001_rls_policies.sql): the existing
-- `notifications_select_self` policy only covers a participant reading their
-- own rows (`user_id = auth.uid()`), which doesn't cover invitation-email
-- rows (`user_id` is null — the recipient has no `users` row yet, see
-- lib/db/schema/audit.ts's doc comment) or an admin's need to see every
-- notification for their tournament (lib/notifications/list.ts, the admin
-- notification center at app/(app)/admin/notifications/page.tsx).
--
-- Hand-authored, not drizzle-kit generated — same rationale as
-- 0001_rls_policies.sql: RLS policies aren't representable in drizzle's TS
-- schema. This is defense-in-depth documentation of the intended access
-- model; app code reads `notifications` via the service-role `db` client
-- with an explicit `tournamentId` filter (lib/notifications/list.ts's doc
-- comment explains why), so this policy is never actually exercised by the
-- current code path, same as `sync_logs_select_admin` and
-- `score_audit_logs_select_admin` aren't exercised by lib/audit/log.ts or
-- lib/sync/diagnostics.ts today.

create policy "notifications_select_admin" on public.notifications
  for select to authenticated
  using (public.is_tournament_admin(auth.uid(), tournament_id));
