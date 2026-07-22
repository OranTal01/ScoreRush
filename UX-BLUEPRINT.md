# UX-BLUEPRINT.md

Status: Phase 0 planning document. Describes intended screens and flows — no UI has been built yet.

## 1. Design system foundation

The approved visual identity is **Premium Fantasy Refined**, carried over in spirit (not in literal code) from the legacy project's `docs/design-reference/premium-fantasy-refined/` and `PREMIUM_FANTASY_REFINED_IMPLEMENTATION_SPEC.md`.

Core intent to preserve:

- Calm, mature, premium — never casino, never a generic SaaS dashboard, never childish.
- Dark navy base (`#080B14` page / `#151B2A` card family), restrained gold for rank/points/rewards, muted cyan for interaction, green for success, red for live/danger, coral for celebration accents only.
- Color communicates state, not decoration — a splash of color means "something happened."
- Mobile-first, Hebrew RTL by default, large numeric typography, tabular numerals for anything that changes.
- Motion is purposeful: rank hero float, podium stagger, count-up points, save-button morph, once-only celebrations. No looping motion stacking (max one focal loop per card). Full `prefers-reduced-motion` support.

**Action for Phase 2:** port the actual design tokens (colors, type scale, spacing, radii, motion tokens/springs) from the legacy implementation spec into this repo as `docs/design-reference/` + a generated Tailwind theme + a `motion/` token module — not duplicated by hand a second time, but re-derived from the same source of truth to avoid drift.

**What's new relative to the legacy single-tournament app:** this product supports multiple tournaments per account, so the navigation and information architecture need a **tournament switcher** the old app never needed.

## 2. Navigation model

**Mobile (primary experience):**

- Fixed bottom navigation: בית (Home) / משחקים (Predictions) / טבלה (Leaderboard) / בונוסים (Bonuses).
- A tournament switcher lives in the header (not the bottom nav) — tapping it opens a sheet listing the user's tournaments with quick-switch, plus "join another tournament" / "create tournament" (admins only) entries.
- Profile, achievements, and notifications are reached from the header/profile entry point, not the primary 4 tabs (keeps the tab bar uncluttered, consistent with the legacy design's restraint).

**Desktop:**

- Top bar (~72px) with horizontal tabs, tournament switcher inline in the top bar (not a separate sheet), admin entry point visible only to admins of the active tournament.

## 3. Participant-facing screens

| #   | Screen                               | Purpose                                                                                                                                                                                |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Login                                | Google OAuth + magic link. No password field.                                                                                                                                          |
| 2   | Onboarding                           | First-time profile setup (display name, avatar/initials), shown once per account.                                                                                                      |
| 3   | Join tournament (invitation landing) | Resolves an invitation link/token, shows tournament summary, confirms join.                                                                                                            |
| 4   | Home dashboard                       | Rank hero, next match card, latest result, leaderboard preview, achievements, activity feed, tournament leaders — mirrors the legacy home layout, now scoped to the active tournament. |
| 5   | Predictions (match list)             | All matches for the active tournament, grouped by stage/matchday, with lock-time status per match.                                                                                     |
| 6   | Match details / prediction entry     | Score controls, lock countdown, save states (idle/pressed/loading/success/error), scoring explanation once resolved.                                                                   |
| 7   | Live match center                    | Live score, live clock, user's locked-in prediction, no editing.                                                                                                                       |
| 8   | Leaderboard                          | Full ranked list + podium, own-row highlight, rank movement indicators.                                                                                                                |
| 9   | Participant profile                  | Public-facing profile: rank history, achievements, streaks, prediction accuracy.                                                                                                       |
| 10  | Bonuses                              | Bonus categories, slot picks, current bonus leaders, points breakdown.                                                                                                                 |
| 11  | Groups                               | Group-stage tables and group ranking predictions (for competitions that have groups).                                                                                                  |
| 12  | Tournament bracket                   | Knockout bracket visualization, where applicable.                                                                                                                                      |
| 13  | Tournament statistics                | Top scorer / top assists / top team style leaders, sourced from the bound data provider.                                                                                               |
| 14  | Activity feed                        | Social feed of scoring events, rank changes, achievement unlocks across the tournament.                                                                                                |
| 15  | Notifications                        | List of past notifications; preferences link.                                                                                                                                          |
| 16  | Profile & preferences                | Account-level settings, notification preferences, linked tournaments.                                                                                                                  |

(Numbering follows the product brief; "prizes" is surfaced as a section of the Leaderboard/Tournament screens rather than a standalone screen — see flow 5 below.)

## 4. Admin-facing screens

| #   | Screen                   | Purpose                                                                                                        |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 1   | Admin overview           | Tournament health at a glance: sync status, pending predictions to lock, recent overrides.                     |
| 2   | Participant management   | Member list, roles, invitation status, remove/re-invite.                                                       |
| 3   | Match diagnostics        | Per-match raw provider payload vs. normalized canonical result, contradiction warnings.                        |
| 4   | Provider health          | Sync status, last successful sync, error history for the bound data provider.                                  |
| 5   | Sync logs                | Chronological log of sync attempts, successes, failures.                                                       |
| 6   | Scoring configuration    | Set point values (exact/winner+diff/winner/wrong), group ranking points, knockout rules.                       |
| 7   | Bonus & prize management | Define bonus categories, slots per category, points per slot, duplicate-stacking toggle, prize per final rank. |
| 8   | Recalculation preview    | Dry-run showing leaderboard delta before committing a rule/result change.                                      |
| 9   | Overrides                | Manual override entry form (reason, evidence, reversible), override history.                                   |
| 10  | Notification center      | Delivery status for sent notifications (once notifications exist).                                             |
| 11  | Audit log                | Full chronological log of all admin actions in the tournament.                                                 |
| 12  | Tournament settings      | Name, competition type, provider binding, invitation settings, lock-time policy.                               |

## 5. Key flows

**A. Onboarding & join**
Login → (first time) profile setup → open invitation link → confirm join → land on tournament home. If the user already has other tournaments, joining a new one adds it to the switcher without disrupting existing ones.

**B. Prediction entry & lock**
Browse matches → open a match → adjust score with ± controls → save (idle → pressed → loading → success/saved) → editable again anytime before lock → countdown escalates visually as lock approaches → at lock, controls become read-only, prediction shown as a static value.

**C. Result → score explanation**
Match resolves (provider sync + normalization) → canonical result computed → prediction scored against it → participant sees points earned with a plain-language explanation ("ניחשת את המנצחת ואת הפרש השערים") → leaderboard updates → activity feed logs the event.

**D. Bonus predictions**
Within the tournament's configured bonus window → participant picks players/teams into the admin-defined slots (duplicates allowed if configured) → bonus leaders update as the tournament progresses using the same canonical stats snapshot used everywhere else (no independent fetching in the UI).

**E. Final standings & prizes**
Tournament reaches a terminal state (final match resolved, champion/runner-up determined) → final leaderboard locks → each rank's admin-defined prize is displayed against the corresponding participant.

**F. Admin configuration**
Create tournament → choose competition type → bind provider (or manual mode) → configure scoring/bonus/prize rules → invite participants → monitor sync/diagnostics during the tournament → use recalculation preview + overrides only as last resort, always with a reason.

## 6. Responsive strategy

Reuse the breakpoint strategy validated in the legacy implementation spec conceptually:

- Mobile: single column, fixed bottom nav, content capped at ~480px on very large phones, zero horizontal overflow.
- Tablet (~768px): still single column, centered, wider max-width.
- Desktop (≥1024px): three-column grid (left: rank hero + achievements, center: predictions/live/result, right: leaderboard + activity), top bar navigation replaces bottom nav.

Exact pixel values, type scale, and motion timings are re-derived from source tokens in Phase 2 rather than hardcoded here.

## 7. States & error handling

Every data-bound screen needs explicit: loading (skeleton, not spinner-only), empty (first tournament, no matches yet, no activity yet), error (provider failure — must never render an empty/zeroed leaderboard; show last-known-good data with a visible "data may be delayed" indicator instead), and offline (PWA — cached last-known state, clear "you're offline" affordance).

## 8. Mobile web now, native distribution later

MVP ships as a responsive, installable PWA (mobile-first web). No native app-store build is in scope for Phases 1–9. The **decision** of whether a future store release is a thin native wrapper (Capacitor/Expo) around this same web app, or a separate native client, is deferred — see [DECISIONS.md](./DECISIONS.md) and [ARCHITECTURE.md](./ARCHITECTURE.md#12-future-native-distribution). The UI must not be built in a way that assumes web-only APIs with no native equivalent, to keep that door open cheaply.

## 9. Content & localization

Hebrew RTL is the only supported language for MVP, following the legacy project's established terminology rules (never קלע/קלעה; use כבש/הבקיע, ניחש תוצאה מדויקת, ניחש את המנצחת, ניחש את הפרש השערים, צבר נקודות, עלה/ירד בדירוג). Scores, dates, and Latin names are LTR-isolated within RTL flow. Copy strings should live in a typed content module (not scattered inline) so a future English/multi-language pass is additive, not a rewrite — but multi-language itself is out of scope for MVP.
