# Competition and clarity upgrade — 13 September 2026

Production: https://scorerush-sigma.vercel.app

Final production deployment: `dpl_7YBRTc6qMNH1hdknWt5tCevUoKeS` — READY. Authenticated homepage reload verified the final release, including initials fallbacks. Post-deployment runtime error scan returned no errors.

## Delivered

- Personal homepage focuses on missing original onboarding entries first, otherwise the current/next matchday. Completion excludes automatic defaults and cancelled/postponed fixtures. A real deadline, shared ranking, points and measured gaps make the next action clear.
- Standings include everyone, explain shared places and competition ranking (1, 2, 2, 4), highlight the caller, link directly to their row and reveal the points breakdown. The podium includes every person sharing a top-three rank. Movement explicitly refers to the prior stored ranking update, not an invented matchday baseline.
- Quick prediction entry saves one match at a time, shows confirmed success, updates round progress and focuses the next missing prediction. Blank fields cannot become 0–0. Validation, bounded requests and the existing authenticated/RLS-protected write path handle lock and network failures. Updates that affect no row cannot report success.
- Draft guards cover navigation, filters and switching views. Confirmed changes discard drafts consistently, including cards that remain visible. Numeric controls, matching filter heights and bottom navigation clearance work at narrow widths.
- Published evening summaries have real stars, exact-score leaders, measured movers, personal contributions and a downloadable 1080×1350 PNG. Ties are respected. Images are generated locally; no private standings are sent to an image service. WhatsApp text sharing remains user-initiated.
- Admin overview shows readiness for the upcoming round and original onboarding separately, with missing counts, clear lock semantics, invitation access and update status. Only completion counts, never future prediction values, are exposed by the readiness view. Used ranking/bonus structures explain why they are locked; permitted scoring/deadline controls remain editable.
- Retained the dark blue/cyan/gold visual system, made cards and controls consistent, reduced mobile hero height and replaced missing profile initials with name-based fallbacks.

## Verification

- Full suite during implementation: 295 passed, 1 skipped. Subsequent focused suite after podium/draft guard additions: 23 tests passed across 6 files. Includes shared podiums, round selection, default-vs-explicit predictions, draft cancellation, blank scores and lock races.
- ESLint, TypeScript via production build, local production build and whitespace checks passed.
- Isolated actual-component browser harness: 4 pages at widths 320/390/768/1440 in Chromium and WebKit (32 layout checks total). No document overflow or browser exceptions. Mocked successful saves, lock failures, next-input focus and actual PNG download passed in both engines. Exported PNG and mobile/desktop screenshots were visually inspected.
- Authenticated production inspection covered the personal homepage, next-round quick entry (18 forms), equal 48px search/round controls, shared standings, self jump and points expansion, admin readiness (17 rows), editable scoring controls, narrow date/time fields and the empty summary state. Browser error log and Vercel runtime error scan were empty during verification.
- Database read-only check confirmed readiness counts and the published-summary query. No live predictions, scores, settings, memberships or onboarding state were changed by verification. No migrations were required for this upgrade.

## Reproduction and limits

After `npm run build`, run `node scripts/serve-ui-review.mjs` and `node scripts/verify-competitive-ui.mjs`. Repeat with `UI_REVIEW_ENGINE=webkit`. The fixture server rejects all writes; browser interception supplies save responses and has no database access. Screenshots are written under `/tmp/scorerush-ui-review`.

Testing used simulated viewports and WebKit, not physical phones. Published recaps are currently empty because no eligible evening has completed since summary activation; historical narratives were not fabricated. Live authenticated prediction writes were intentionally not submitted.

The authoritative working tree remains `/Users/oran/.codex/worktrees/c2f8/ScoreRush`. Earlier dirty work is preserved and changes remain uncommitted. Deploy from this tree or integrate it before deploying from the Desktop checkout.
