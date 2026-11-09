# Live experience — 14 September 2026

Production: https://scorerush-sigma.vercel.app/live

Deployment: `dpl_7QETF4zr7pysBvuXwks6ZkdvQXfj`, READY, production alias verified.

## Released

- A dedicated Hebrew RTL match-evening screen, linked from home, predictions and standings. It shows current results, the participant's locked prediction, provisional points, and projected rankings alongside awarded points. Existing scoring rules and shared ranks apply.
- Projections are read-only: they never persist points or change picks. They exclude onboarding/open picks, unavailable regulation-time results, stale data and unnormalized matches. Extra-time and shootout goals do not count toward the 90-minute prediction rules.
- The screen refreshes every 30 seconds while visible, supports manual refresh and resumes on connection/visibility changes. Failed refreshes preserve the last view. Expired provisional standings are withdrawn. Responses are private/no-store and scoped to the authenticated tournament membership.
- Durable detection for single-goal score changes, score corrections, red cards, withdrawn card reports, kickoff and final whistle. Initial and stale snapshots do not replay old events; concurrent/older provider observations cannot overwrite newer snapshots. Goal announcements do not invent a scorer or a VAR explanation.
- Optional goal/red-card phone preferences, off by default. Existing reminders and summaries are preserved. Event delivery checks membership, preferences, subscription age, onboarding, the lock and the push master switch, and claims each delivery once. Live events expire after 120 seconds at the push provider.
- Migration `0013_live_experience.sql`: optional match detail column, runtime/event/state tables and a membership-guarded function exposing only aggregated awarded points. Applied with verified project/history and a transaction. No existing predictions, awarded points or tournament settings were changed by the migration.
- Conditional Supabase job `scorerush-live-events`: checks every minute, calls the authenticated live endpoint only near matches and only after provider live access is enabled. Existing schedules and their secrets were preserved.

## Paid provider activation declined

The owner explicitly declined all app-related payment on 14 September 2026. Keep access delayed; do not activate the paid integration. See `OPERATING-CONSTRAINTS.md`. The activation notes below record the original technical handoff and are not authorization or planned work.

The current token returned scores but no goal/booking arrays even with unfolding requested. Runtime intentionally remains `access='delayed'`. The UI explicitly labels the delay and disables unavailable live notification choices. No paid subscription was purchased, and the conditional live job currently makes no network calls.

Football-data.org's pricing page checked during implementation lists **Free + Deep Data, €29/month** for live scores plus goals/bookings; VAT may apply. The €12 live-scores tier does not include booking events. Source: https://www.football-data.org/pricing

Historical activation procedure, only applicable if the owner explicitly reverses the no-payment constraint and upgrades the supplier plan:

1. Verify the actual production token and competition coverage using the read-only `scripts/probe-live-provider.mjs`, including `bookings` arrays on completed matches with unfolding enabled. Do not infer paid access from a successful score request alone.
2. Set the football-data runtime access to `events`, reset the lease/error fields and set `enabled_at` to the activation time. Existing delayed observations naturally seed without replay because the detector excludes old gaps. If activating in the middle of live matches, clear only their transient `live_match_state` rows to explicitly establish a fresh baseline.
3. During a real match, verify provider freshness, the event feed and one consenting test device. Real phone delivery of the new events has **not** been exercised while the supplier gate is closed. Provider polling is approximately once per minute, not an instant event stream; supplier/network delays still apply.
4. Each participant opts into goals and/or cards in their profile. No live events are routed to WhatsApp by this change.

## Verification

- Full Vitest suite: 330 passed, 3 opt-in database tests skipped.
- Separately ran the opt-in live database test: passed. Synthetic users, matches, events and migration DDL were rolled back. Verified deduplication, score corrections, unchanged awarded points, onboarding suppression, member-only event/aggregate reads and denied runtime-state writes.
- TypeScript, scoped ESLint and production builds passed.
- Chromium and WebKit: 7 live scenarios at widths 320, 390, 768 and 1440, 56 layout checks total. No horizontal overflow or page errors. Verified manual and automatic refresh, failures, expiry, tournament-change isolation, recovery and extra-time explanation. Screenshots under `/tmp/scorerush-ui-review/{chromium,webkit}`.
- Authenticated production view showed the real standings (18 members at verification, self rank 4 / 60 points) and upcoming fixtures. The first request immediately after deployment briefly showed the membership fallback; subsequent full loads and refreshes resolved the correct membership. No production runtime errors appeared in the reviewed interval.
- Anonymous `/api/live` redirects to login. Authorized `/api/cron/live` returned `inactive_or_running`; database confirmed provider access delayed and no live poll timestamp. Existing reminder/default/sync jobs remain active.

The working tree contains substantial earlier work from this same task; it was preserved and has not been reset or committed as part of this release.
