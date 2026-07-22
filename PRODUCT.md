# PRODUCT.md

**Product name: ScoreRush** (confirmed 2026-07-22 — see [DECISIONS.md](./DECISIONS.md#2-decisions-resolved-on-2026-07-22). GitHub repo is `OranTal01/ScoreRush`.)

Status: Phase 0 planning document. No code, database, or infrastructure exists yet.

## 1. One-line summary

A premium, private, social football-prediction platform. Friends and family (or any private group) compete on predictions, dynamic scoring rules, bonuses, and admin-defined prizes — across any tournament (World Cup, Euro, Champions League, or a fully custom competition) — with real accounts, a real database, and a real backend.

## 2. Relationship to the legacy project (world-cup-bets)

This is a **new product in a new repository**, not a continuation of `OranTal01/world-cup-bets`.

The legacy project is used only as:

- A source of proven business rules (9/6/3/0 scoring, knockout handling, bonus stacking, champion/runner-up exclusion).
- A source of historical data for a possible future migration.
- A visual/design reference (Premium Fantasy Refined).
- A comparison baseline when validating this system's scoring output.

The legacy project's architecture (Google Sheets as a data source, no auth, no database, single hardcoded tournament) is explicitly **not** carried over. This system is built for multiple concurrent tournaments, real accounts, and admin-configurable rules from day one.

## 3. What this is not

- Not a real-money betting product.
- Not a casino or gambling product.
- Not a public fantasy-sports platform aiming at mass-market users.
- Not a rebuild of the legacy project's architecture — only its validated business rules are reused.

This distinction matters concretely: copy, visuals, and even the product/repo name must avoid gambling-adjacent language (e.g. "bet," "odds," "wager") both for tone and because app store review (Apple/Google) treats such language as a gambling-policy trigger. "Prizes" must be modeled as admin-defined descriptions, not cash payouts processed by the app (see [SCORING-RULES.md](./SCORING-RULES.md#8-prize-engine)).

## 4. Product goals

**Primary**

- Let a group of people privately compete on football predictions for any tournament, with correct, transparent, auditable scoring.
- Let an organizer (admin) fully configure the rules of a tournament — scoring, bonuses, prizes — without code changes.
- Support running multiple tournaments (sequentially or concurrently) from one platform and one account system.
- Be trustworthy: no silent data loss, no unexplained scores, full audit trail for anything a human overrides.

**Secondary**

- Be pleasant enough to open daily for weeks without fatigue (see [UX-BLUEPRINT.md](./UX-BLUEPRINT.md)).
- Be architected so a future native app-store release (iOS/Android) is an additive step, not a rewrite.
- Be maintainable by a small team (realistically: one developer + AI pair-programming), so complexity must stay proportionate.

## 5. User types and roles

| Role                                            | Scope                           | Description                                                                                                                                                                                      |
| ----------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Platform Owner / Super Admin**                | Global                          | Creates tournaments, manages global settings, can act as admin on any tournament. Effectively the product owner (you).                                                                           |
| **Tournament Admin / Organizer**                | Per tournament                  | Creates and configures a specific tournament: scoring rules, bonus categories, prizes, invitations, match data sync, overrides. A participant can also be an admin of a tournament they created. |
| **Participant**                                 | Per tournament (via membership) | Registers/signs in, joins a tournament via invitation, submits predictions until lock time, views leaderboard/bonuses/profile.                                                                   |
| **Guest / Viewer** _(future, not in Phase 1-6)_ | Per tournament, read-only       | A possible future read-only share link for non-participants (e.g. "watch the family league"). Not required for MVP — flagged as open question in [DECISIONS.md](./DECISIONS.md).                 |

A single user account can hold different roles in different tournaments (e.g. admin of the "Fisher Family Champions League Pool," plain participant in a friend's "Office World Cup Pool").

## 6. Permission matrix (summary)

| Action                                     | Participant                                     | Tournament Admin                                                    | Platform Owner                  |
| ------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------- | ------------------------------- |
| Submit/edit own predictions before lock    | ✅                                              | ✅                                                                  | ✅                              |
| View own predictions after lock            | ✅                                              | ✅                                                                  | ✅                              |
| View others' predictions before lock       | ❌ (resolved: hidden until lock — DECISIONS.md) | ❌ (same rule, no admin bypass)                                     | ❌ (same rule, no admin bypass) |
| View leaderboard                           | ✅                                              | ✅                                                                  | ✅                              |
| Create a tournament                        | ❌                                              | ❌ (MVP: owner-only — DECISIONS.md)                                 | ✅                              |
| Configure scoring rules / bonuses / prizes | ❌                                              | ✅ (own tournament, before rules are locked — see SCORING-RULES.md) | ✅                              |
| Invite participants                        | ❌                                              | ✅                                                                  | ✅                              |
| Trigger data re-sync                       | ❌                                              | ✅                                                                  | ✅                              |
| Add a manual score override                | ❌                                              | ✅ (with reason, logged)                                            | ✅                              |
| View audit logs                            | ❌ (own actions only, if surfaced)              | ✅ (own tournament)                                                 | ✅ (all)                        |
| Manage other admins                        | ❌                                              | ❌                                                                  | ✅                              |

Full RLS-level enforcement is defined in [DATABASE.md](./DATABASE.md#5-row-level-security-strategy).

## 7. Supported tournament types

The platform models a **generic "Competition/Tournament" entity**, not a hardcoded World Cup. Supported out of the box:

- FIFA World Cup
- UEFA Euro
- UEFA Champions League
- Custom tournaments (admin defines teams, matches, and stages manually or via a generic provider)

Each tournament has its own scoring configuration, bonus categories, prize table, participant list, and (where available) external data provider binding. See [ARCHITECTURE.md](./ARCHITECTURE.md#6-provider-adapter-pattern) for how different competitions can use different data sources.

## 8. Core value propositions

1. **Dynamic scoring** — point values for exact score / correct winner+difference / correct winner / group ranking are all admin-configurable per tournament, not hardcoded.
2. **Dynamic bonuses** — admin defines bonus categories (top scorer, top assists, custom categories) and how many "slots" each participant gets and how many points each slot is worth.
3. **Dynamic prizes** — admin defines a prize (free-text description, not a cash transaction) per final leaderboard rank.
4. **Multi-tournament** — one account, many private leagues, no code changes between a World Cup pool and a Champions League pool.
5. **Trust and auditability** — every manual intervention is logged with a reason, an admin identity, a timestamp, and is reversible.

## 9. Core user journeys

**Participant**

1. Register or sign in (Google or magic link).
2. Receive/open an invitation link → join a specific tournament.
3. Onboard (see participant profile setup, avatar/initials).
4. Submit match predictions until each match's lock time.
5. Submit group-stage ranking predictions (if applicable) before the group stage starts.
6. Submit bonus predictions (top scorer, etc.) within the tournament's bonus window.
7. Track live rank movement, leaderboard, and scoring explanations as matches resolve.
8. View personal profile: history, achievements, streaks.
9. See final standings and the prize tied to their final rank.

**Tournament Admin**

1. Create a tournament, select competition type, bind a data provider (or go manual).
2. Configure scoring rules, bonus categories + slots + points, and prizes per rank.
3. Invite participants (invitation links).
4. Monitor data sync health and match normalization status.
5. Resolve provider discrepancies or add a manual override with a reason, when necessary.
6. Recalculate scores after a rule or result correction, review the recalculation preview before applying.
7. Review audit logs of all changes made in their tournament.

## 10. Success criteria (qualitative)

This is a private-use product, not a growth product — success is not measured in signups. It is measured by:

- Zero unexplained or disputed scores across a full tournament.
- Zero data loss from a provider outage (system falls back gracefully, never silently zeroes out valid data).
- An admin can configure a brand-new tournament (different competition, different rules) without any code change or developer involvement.
- The experience feels premium and worth opening daily — validated qualitatively against the Premium Fantasy Refined design intent.

## 11. Future distribution ambition

Long-term, possible listing on the Apple App Store and Google Play. This is explicitly **not** an MVP requirement — the architecture should not block it later (mobile-first responsive PWA now; native wrapper decision deferred, see [ARCHITECTURE.md](./ARCHITECTURE.md#12-future-native-distribution) and [ROADMAP.md](./ROADMAP.md)).
