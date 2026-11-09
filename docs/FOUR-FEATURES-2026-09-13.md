# Four additions — 13 September 2026

Implemented on the existing ScoreRush design and tournament model:

- Match details show the friends' predictions, submitted-only outcome distribution, own-row highlight and scored points after final lock. Caller-bound Supabase reads and the database lock RPC enforce the existing RLS policy, including managers. Open retrospective onboarding, postponement and cancellation do not reveal the card. A second lock check drops a read if onboarding reopens during the request.
- `/history` stores a real closing snapshot for each observed round, with overall rank/total, round match points, exact predictions and all tied round winners. It includes a participant selector, accessible rank graph and numeric table. A round waits for all non-cancelled games, normalized final results, scoring of every member and the end of retrospective onboarding. Completed rounds first observed after the feature started do not receive fabricated historic ranks. Captures are immutable and serialized with scoring; later corrections are reflected in current standings and future captures.
- Device drafts are shared between quick entry, match details and the guided first pick. Keys include tournament, participant and match. Versioned input validation, 45-day expiry, baseline reconciliation, lock guards, visible unsent notices, storage failure handling and clearing only on confirmed submission are included. Browser storage is local to this device; drafts are never submitted automatically or counted as completed picks. The server and RLS still decide whether a submission is accepted.
- `/welcome` guides members through nickname, actual tournament scoring rules, a confirmed first prediction and optional device notifications. A successful invitation sets the joined tournament cookie before opening the guide. Profile links allow returning later, and the home invitation can be dismissed per member/device. Skipping notifications never claims that notifications are enabled.

## Verification

- Full unit/component suite: 314 passed, two opt-in database tests skipped in the ordinary run.
- New history database integration test: passed separately against the configured database in a transaction that rolled back all synthetic records and migration DDL. Verified onboarding privacy for manager/member, post-lock visibility, outsider isolation, denied history writes, observed closure, idempotence, no backfilled rankings and immutable historical snapshots after corrections.
- TypeScript, targeted ESLint and production build passed. After the final small match-form reconciliation change, the four affected form/draft tests and TypeScript/ESLint passed again.
- Chromium and WebKit: 36 layout checks each across nine views at widths 320, 390, 768 and 1440. No horizontal overflow or page errors. Verified quick saving, server lock rejection, focus progression, cross-screen draft restore without a request, confirmed save clearing, full welcome flow, history selection and PNG export.
- Inspected representative screenshots for the history, welcome and friends screens. This is browser simulation, not a physical iPhone/Android test.

## Activation

- Applied additive migration `0012_round_history` after verifying the exact database target and migration journal.
- Initialized two active/upcoming tournaments: eight rounds registered, zero invented historical captures. Existing picks, points and onboarding settings were not changed by these activation scripts.
- Cron captures eligible round closures after successful synchronization and recomputation. Until the first eligible closure, the history screen explains what is pending.
- Live goal/red-card push and automatic WhatsApp group transport are outside these four additions.

Production deployment `dpl_ACgqBV3kjqNZ3AJ34FnUNYN1kj3W` is READY and aliased to https://scorerush-sigma.vercel.app (build URL: https://scorerush-3puw8o9rv-world-cup-friends.vercel.app).

Authenticated production checks passed: history shows round 1 at 18/18 waiting for onboarding to close, welcome detects the existing submitted prediction, match details show only the user's own prediction and the sealed friends card during onboarding, and the desktop home contains the new guide entry. No horizontal overflow at 390/1440 pixels, no browser errors, and no Vercel runtime errors in the post-deployment scan. Production verification was read-only; no guesses were submitted and onboarding was not closed. The production site remains open in the app browser with its viewport reset.
