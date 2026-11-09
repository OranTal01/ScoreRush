# Hebrew names, fixture audit and evening recaps — 15 October 2026

## Display names

`lib/content/football-names.he.json` contains 36 teams (including provider short names and aliases), 899 player entries and six names from older bonus statistics. `docs/football-names-he.csv` is the editable review/export copy; the application reads the JSON source.

Names are localized at display boundaries: match lists/detail, group ranking/standings, home bonus leaders, bonuses and live match descriptions. Team search accepts Hebrew and English. Bonus selection resolves both languages to the original provider ID and canonical stored name. Existing unknown/manual choices are retained, and identical player names require the team to disambiguate. Member nicknames are intentionally not renamed.

No team IDs, player IDs, scores, results or existing predictions were migrated.

## Production fixture audit

Compared the active Champions League 2026/27 tournament to the football-data CL/2026 matches endpoint:

- 144 distinct fixture IDs in both sources; no missing or extra fixtures.
- Eight rounds, 18 matches each. All 36 teams have eight fixtures.
- Home/away provider IDs, kickoff times and matchday numbers agree.
- All 36 completed results agree with the provider's regular-time scores.
- Round 3: 20–21 October 2026. First kickoff 20 October 19:45 Asia/Jerusalem.
- UEFA's official 2026/27 league fixture article independently agrees with round 3 dates.

Participation at audit: 19 members, two without any explicit predictions. Round 2: three with no explicit picks, three partially complete and 13 complete. Automatic default picks are not counted as submitted picks. Detailed private member results were reported directly to the owner, not placed in this file.

## Lock rule applied

Owner requested one minute before kickoff. Changed the active tournament's `match_lock_minutes` from 5 to 1 and updated 108 scheduled, not-yet-locked fixtures in one transaction. Verified all 36 already-locked fixtures retained their lock timestamps. An audit entry records the owner, old/new values and reason. The existing DB trigger applies the same rule to future provider imports. Rules, welcome and prediction-list text reflect the configured value (including singular Hebrew).

Existing onboarding remains open for round 1. No retrospective entry window was extended, and no completed predictions were edited. Owner still needs to specify retrospective scope and an end time.

## Evening recap delivery

The existing production digest engine already waits for every non-postponed/non-cancelled match in an Israeli evening, a confirmed scoring run, and a stabilization period. Published recaps for 13 and 14 October exist.

Updated new recap text to include everyone tied in the top three ranks, joint evening stars and the largest rank jump, and an evidenced change at the top. Existing published summaries remain immutable.

Added an optional local WhatsApp worker in `tools/whatsapp-bridge`. The owner approved a free linked-device connection on a computer that stays active, after being told the unofficial connection may disconnect or be restricted. The worker reads only this tournament's published recaps and verifies the invitation's group and account membership before sending. No group joining, unrelated chats or contacts, paid services, serverless browser or live-data upgrade.

Persistent pre-send intent and message acknowledgement prevent automatic duplicates; ambiguous attempts remain flagged for review. Initial historical digests and digests older than 30 hours are skipped. The worker is excluded from the Vercel deployment and has a separate dependency lockfile. Session/config/state remain ignored and private on disk. A local LaunchAgent starts the worker after login. The status/QR page is localhost-only at port 4199.

QR linking and verification of the destination group are required before the worker can send. No test message has been sent to the real group.

## Validation

- 354 app tests pass; three opt-in database integration tests skipped.
- Four worker tests pass: history/expiry checks, persist-before-send, duplicate suppression, ambiguous delivery, and failed persistence blocking a send.
- Next production build and TypeScript pass.
- Scoped ESLint passes.
- Local browser inspected at 390px and 1440px: Hebrew bonus names, automatic text direction and no document overflow.
- Production deployment and authenticated mobile/desktop checks are recorded after release below.

Production release: initial `dpl_AxwDZF2EnnwJaVPAF2vfJ9uBJ3rF`, followed by `dpl_2r2QtKSP66GLdkXPCW2AbiG837is` to preserve English searching in the ranking editor as well. CLI login had expired; used the already-authenticated Vercel connector for the same verified team/project. Uploaded only application source/config/public assets, with no environment secrets or WhatsApp worker/session files.

Authenticated production verification: completed-match detail (Lens–Sporting), current match list, bonuses and group rankings display Hebrew. Searching `Bayern` and `באיירן` returns the same match. Round-3 deadline is shown as 20 October 19:44 Israel time. Bonus values and provider associations were verified through unit tests; real production selections were not submitted or changed. At 390px and 1440px, document widths stay within the viewport. No production runtime errors reported in the release window. The WhatsApp worker is running as a local LaunchAgent; QR linking remains pending.

Final deployment reached READY and both existing production domains were assigned successfully. Authenticated production ranking search for `Bayern` shows only באיירן מינכן. The original selections were left unchanged and the user was returned to the predictions page. Final TypeScript and whitespace checks pass. The QR/status tab remains open for the owner.
