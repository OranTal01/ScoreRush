# DATABASE.md

Status: Phase 0 planning document. Conceptual data model — not a migration, not yet implemented, no database has been created or connected.

## 1. Purpose of this document

Defines the entities needed to support dynamic scoring, dynamic bonuses, dynamic prizes, and multi-tournament operation. Field lists here are planning-level (purpose + key fields), not final DDL — actual Drizzle schema/migrations are written in Phase 3.

## 2. Entity overview

**Identity & tenancy**

- `users` — platform accounts (Supabase Auth-backed).
- `tournaments` — a single competition instance (e.g. "Fisher Family — Champions League 2027").
- `participants` — membership of a user in a tournament, with a role (`tournament_admin` / `participant`) and a display profile scoped to that tournament (nickname/avatar can differ per tournament if desired).
- `invitations` — single-use, expirable tokens granting join access to a tournament, optionally bound to an email.

**Competition structure**

- `teams` — teams participating in a tournament (name, flag/asset, group, seed).
- `matches` — individual fixtures: stage, group, home/away team, kickoff, status, canonical results (see field list below).

**Configuration (the "dynamic" core of the product)**

- `scoring_rules` — per-tournament point values: exact score, correct winner+difference, correct winner only, wrong prediction, group-ranking-per-position, knockout-specific overrides.
- `bonus_categories` — per-tournament bonus categories (e.g. Top Scorer, Top Assists, Top Team, Champion, Runner-up, or fully custom categories for non-World-Cup tournaments).
- `bonus_slots` — how many picks a participant gets per category and the point value of each slot (e.g. slot 1 = 20 pts, slot 2 = 10 pts, slot 3 = 10 pts), with a per-category duplicate-stacking flag.
- `prizes` — per-tournament, per-final-rank prize description (free text / structured description, not a payment).
- `tournament_providers` — which data-provider adapter(s) a tournament is bound to (match/result source, bonus-stats source), or "manual" mode.

**Predictions & scoring output**

- `match_predictions` — a participant's score prediction for a match, submission/edit timestamps, lock status at time of submission.
- `group_predictions` — a participant's predicted final group standings, submitted before the group stage starts.
- `bonus_predictions` — a participant's picks into each bonus category's slots.
- `bonus_stats` — the resolved/cached bonus statistics snapshot (goals, assists, team goals, etc.) used consistently across bonus breakdown, leaderboard, and detail views — mirrors the legacy project's "one resolved snapshot everywhere" rule.
- `leaderboard_snapshots` — periodic (or event-triggered) captures of full standings, enabling rank-movement history ("עלית 2 מקומות") without recomputing from scratch.

**Trust & operations**

- `score_audit_logs` — every scoring-relevant change (rule edit, recalculation, override) with before/after values.
- `admin_overrides` — manual interventions: reason, evidence reference, admin id, timestamp, reversible flag.
- `sync_logs` — provider sync attempts: outcome, duration, error detail.
- `system_events` — general operational event log (e.g. tournament state transitions, invitation consumed).
- `notifications` — outbound notification records (future, Phase 8), delivery status.

## 3. Key match fields

Carried over and generalized from the legacy project's proven match model:

- internal id, provider id (nullable — manual matches have none), tournament id, stage, group
- home team, away team, kickoff time, status
- duration/period info (regulation / extra time / penalties, where applicable)
- winner, regular-time score (canonical prediction-scoring input), extra-time score, penalty-shootout score
- canonical prediction score (90 min + stoppage only), canonical tournament-stat score (up to 120 min, penalties excluded)
- raw provider payload reference, last synced timestamp
- normalization status, warning/contradiction flag (e.g. team order reversed vs. expected — same class of issue the legacy resolver already handles for sheet-vs-API ordering)

## 4. Relationships (summary)

- A `user` has many `participants` records (one per tournament they've joined).
- A `tournament` has many `participants`, `teams`, `matches`, `invitations`, one active `scoring_rules` configuration (versioned — see §6), many `bonus_categories` (each with `bonus_slots`), many `prizes` (one per awarded rank).
- A `participant` has many `match_predictions`, `group_predictions`, `bonus_predictions`, all scoped to their tournament membership.
- A `match` belongs to one `tournament`; has many `match_predictions` (one per participant, typically).
- `leaderboard_snapshots` belong to a `tournament` and capture all `participants`' standings at a point in time.

## 5. Row-level security strategy

Enforcement lives in Postgres RLS, not only in application code — the application layer is not trusted as the sole gate given this holds other people's data.

| Table family                                                                         | Read                                                                                                                        | Write                                                                               |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `users` (own profile)                                                                | Self only                                                                                                                   | Self only                                                                           |
| `tournaments`                                                                        | Members of the tournament                                                                                                   | `tournament_admin` / `platform_admin`                                               |
| `participants`                                                                       | Members of the same tournament (for leaderboard/profile display)                                                            | Self (join/profile edit); admin (role changes, removal)                             |
| `matches`, `teams`                                                                   | Members of the tournament                                                                                                   | Admin only (or sync job via service role)                                           |
| `match_predictions`, `group_predictions`, `bonus_predictions`                        | Own predictions always; others' predictions **only after lock time** (resolved decision, applies to admins too — no bypass) | Self, only before lock, only own tournament                                         |
| `scoring_rules`, `bonus_categories`, `bonus_slots`, `prizes`, `tournament_providers` | Members (read current config)                                                                                               | Admin only                                                                          |
| `score_audit_logs`, `admin_overrides`, `sync_logs`, `system_events`, `notifications` | Admin of the tournament (+ platform admin); a `notifications` row's own recipient may also read/update it (`user_id = auth.uid()`, when set) | System/service role + admin-initiated actions only |
| `invitations`                                                                        | Admin of the tournament (management view)                                                                                   | Admin creates; consumption is a controlled server-side flow, not direct table write |

**Resolved (see DECISIONS.md):** another participant's predictions for a not-yet-locked match are hidden from everyone except the predicting participant themselves — including tournament admins, with no bypass. This RLS policy must check `now() >= match.lock_time` (or `match.status != 'open'`) before allowing a read of any `match_predictions`/`group_predictions`/`bonus_predictions` row that isn't the requester's own — a genuinely time-dependent policy, not a static role check, so it needs explicit test coverage in Phase 3 (including the boundary moment at lock time itself).

## 6. Rule versioning

Because scoring/bonus/prize configuration is editable by an admin, and because matches get scored progressively over the life of a tournament, `scoring_rules` (and similarly bonus configuration) should be **versioned**, not mutated in place — each match's canonical score is computed against the rules version active when it was scored, and a rule change triggers an explicit recalculation pass (visible via the Recalculation Preview admin screen) rather than silently reinterpreting history. Exact mechanics (allow mid-tournament rule edits at all, or lock rules once the tournament starts) are an open question — see [DECISIONS.md](./DECISIONS.md).

## 7. Audit & override fields (detail)

`admin_overrides` and `score_audit_logs` must carry, at minimum: what changed (entity + field), previous value, new value, reason (required, free text), evidence reference (e.g. link/note pointing at the real provider response that justified the override), acting admin id, timestamp, and a reversible flag/pointer so an override can be cleanly undone. This mirrors the legacy project's rule that manual overrides are rare, last-resort, and must never be silently introduced without inspecting real provider data first.

## 8. Data retention & privacy notes

Participant data (predictions, profile) belongs to a private tournament the user opted into via invitation. No public indexing. Standard account-deletion consideration (removing/anonymizing a user's data on request) is deferred to a later phase but should not be architected against — avoid hard-coding assumptions that make a user's data inseparable from tournament history (e.g. keep display name separate from immutable scoring history where feasible).
