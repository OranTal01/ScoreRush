# ROADMAP.md

Status: Phase 0 planning document. Phase 0 (this document set) is the only work done so far — no code, no packages, no database, no deployment.

Each phase below must end with: passing tests, passing build, passing lint, a separate reviewable commit (or small set of commits) — never one giant unstructured commit. No phase after Phase 1 begins without explicit go-ahead in this conversation.

## Phase 0 — Product & architecture (current)

Deliverables: `PRODUCT.md`, `UX-BLUEPRINT.md`, `ARCHITECTURE.md`, `DATABASE.md`, `SCORING-RULES.md`, `ROADMAP.md`, `DECISIONS.md`.
Exit criteria: all seven documents exist, are internally consistent, and are reviewed/approved by the product owner. No code, no `npm install`, no Supabase project, no commit/push performed as part of this phase.

## Phase 1 — Repository & tooling foundation

- Initialize the Next.js (App Router) + TypeScript strict project.
- Configure Tailwind, ESLint, Prettier, Vitest, Testing Library, Playwright scaffolding.
- Set up the design token foundation ported from Premium Fantasy Refined (colors, type scale, spacing, radii, motion tokens) as re-derived source-of-truth, not hand-copied.
- No database, no auth, no real screens yet — this phase proves the toolchain, CI, and design tokens work.
  Exit criteria: `npm run build`, `npm run lint`, `npm test` all pass on a minimal scaffold; first commit(s) pushed to `OranTal01/ScoreRush`.

## Phase 2 — Static UI prototype

- Application shell: mobile bottom nav, desktop top nav, tournament switcher shell.
- Typed mock data matching the DATABASE.md shapes (not live data).
- Build Home, Predictions, Leaderboard, Bonuses, Groups, Bracket, Profile, and Admin Overview screens against mock data, matching Premium Fantasy Refined visual/motion parity.
  Exit criteria: all screens render correctly at the responsive breakpoints defined in UX-BLUEPRINT.md, no horizontal overflow, reduced-motion respected, tests/build/lint green.

## Phase 3 — Database & auth

- Stand up Supabase, write Drizzle schema/migrations for the entities in DATABASE.md.
- Implement RLS policies (including resolving the open question on prediction visibility before lock).
- Wire Supabase Auth (Google + magic link), invitation-based tournament join flow, participant profile creation.
  Exit criteria: a real user can register, receive/consume an invitation, and appear as a tournament participant in the database, with RLS verified (a participant cannot read another tournament's data).

## Phase 4 — Tournament data pipeline

- Build the provider adapter interface; implement a football-data.org-style adapter (confirmed in DECISIONS.md research to already cover World Cup, Champions League, and Euro fixtures/results on its free tier — this is largely a configuration exercise, not a new integration per competition) plus the "manual" adapter.
- Bonus/statistics data source for the launch tournament (top scorer/assists) — **resolved without a new integration**: football-data.org's own `/scorers` endpoint covers World Cup, Champions League, and Euro on the same free-tier token already used for fixtures/results (DECISIONS.md §3a, confirmed via a real hands-on API call in Phase 4). Manual-entry bonus-stats path still exists as the fallback for custom tournaments or a competition football-data.org doesn't cover.
- Raw storage → validation → normalization → canonical result, with diagnostics surfaced in the admin UI.
- Scheduled sync job + sync logs.
  Exit criteria: real match schedule/results flow end-to-end into canonical results for at least one tournament, with a working manual-entry fallback path (for both match data and bonus stats) and full sync/diagnostic logging.

## Phase 5 — Prediction engine

- Prediction entry UI wired to real data, lock-time enforcement.
- Scoring engine: 9/6/3/0 default (configurable), knockout rules, group predictions, bonus predictions, duplicate stacking, terminal-category (champion/runner-up-style) exclusion.
  Exit criteria: predictions submitted, locked, and scored correctly end-to-end against real or fixture match results; scoring unit tests cover the same scenarios validated in the legacy project (exact/winner+diff/winner/wrong, knockout ET/penalty exclusion, tied bonus winners, duplicate stacking, terminal-category exclusion).

## Phase 6 — Leaderboard

- Aggregation, `leaderboard_snapshots`, rank-movement history, participant comparison views.
  Exit criteria: leaderboard and bonus table always agree (`totalPoints = matchPoints + groupRankingPoints + bonusPoints`) under test; rank-movement UI reflects real snapshot history.

## Phase 7 — Admin tooling

- Match diagnostics, provider health, scoring configuration UI, bonus & prize management UI, recalculation preview, overrides UI, audit log viewer.
  Exit criteria: an admin can configure a brand-new tournament's full rule set (scoring/bonus/prizes) through the UI alone, with no code change, and every override/recalculation is auditable.

## Phase 8 — Notifications

- Email notifications first; push/PWA notifications next; official WhatsApp Cloud API integration deferred until justified.
  Exit criteria: at least one real notification channel (email) delivers reliably with visible delivery status in the admin notification center.

## Phase 9 — Polish

- Full motion/animation parity pass, accessibility audit, performance pass, offline/loading/error state completeness, full responsive review.
  Exit criteria: matches the rigor already demonstrated in the legacy project's Premium Fantasy Refined parity work — nothing "close enough," reduced-motion fully honored, no layout shift, WCAG AA contrast.

## Phase 10 — Migration & launch

- Optional import of historical participants/predictions/results from `world-cup-bets` for comparison/validation purposes.
- Compare computed totals against the legacy system's known-good historical output as a correctness check.
- Staging validation, then production launch for the first real tournament (candidate: an upcoming Champions League pool, per current product intent).
  Exit criteria: a real private group is running a real tournament on the new platform, with confidence the numbers are right (validated against Phase 5/6 test coverage and, where applicable, the legacy comparison data).

## Notes on sequencing

- Phases 3 and 4 could in principle run in parallel (auth/db vs. provider pipeline) since they don't depend on each other, but are listed sequentially to keep each phase's commit history small and reviewable, per the stated preference for incremental, phase-scoped delivery.
- No phase should be started speculatively — each phase begins only after the previous phase's exit criteria are confirmed and the next phase is explicitly requested.
