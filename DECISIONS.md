# DECISIONS.md

Status: Phase 0 planning document. Tracks what's already locked in vs. what's still open.

## 1. Locked decisions

| Decision                                                                                                                                                        | Rationale                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New repository, new architecture — not a continuation of `world-cup-bets`                                                                                       | Legacy project has no auth/DB by design and should stay that way; this product needs real accounts, real persistence, multi-tournament support from day one.                                            |
| Stack: Next.js (App Router) + TypeScript strict + Tailwind + PostgreSQL/Supabase + Drizzle + Zod + TanStack Query + Vitest/Testing Library/Playwright + Vercel  | Matches the product owner's stated technical direction; proven pattern from the legacy project's Next.js/Vercel deployment experience.                                                                  |
| Auth: Supabase Auth, Google OAuth + magic link, no self-managed passwords                                                                                       | Simplicity, security, matches stated requirement.                                                                                                                                                       |
| Scoring, bonuses, and prizes are all admin-configurable per tournament, not hardcoded                                                                           | Core product differentiator — must support World Cup, Euro, Champions League, and custom tournaments without code changes.                                                                              |
| Provider data pipeline discipline (raw → validated → normalized → canonical → scored → aggregated → view model), never conflating raw/canonical/display results | Directly carried over from a rule the legacy project already proved out and depends on for correctness.                                                                                                 |
| No local WhatsApp-Web-bot pattern as a long-term notification channel                                                                                           | Legacy bot requires an always-open terminal and manual session management — not production-grade; official WhatsApp Cloud API or another supported provider is the long-term path, deferred to Phase 8. |
| Visual identity: Premium Fantasy Refined direction (dark navy base, restrained gold, muted cyan, calm/premium/social tone)                                      | Explicit product owner direction, validated design work already exists in the legacy project as a reference.                                                                                            |
| Development proceeds in small, reviewable, test-covered phases (see ROADMAP.md), not one large uncontrolled build                                               | Explicit stated preference; matches how the legacy project's redesign was successfully delivered incrementally.                                                                                         |

## 2. Decisions resolved on 2026-07-22

### Naming — RESOLVED: ScoreRush

Final product name: **ScoreRush**. GitHub repository renamed (manually, by the product owner) from `OranTal01/betting-tournament` to `OranTal01/ScoreRush` on 2026-07-22; verified reachable via the GitHub API (old name now 301-redirects to the new one). Local git remote updated to `https://github.com/OranTal01/ScoreRush.git`. Note: the local working directory folder itself is still named `betting-tournament` on disk — cosmetic only, does not need to match the repo name, and was left as-is to avoid disrupting the current session's paths.

### Prediction visibility before lock — RESOLVED: hidden until lock

A participant cannot see another participant's prediction for a match until that match's lock time has passed. Applies to `match_predictions` (and by extension `group_predictions`, `bonus_predictions`) RLS policy — see [DATABASE.md](./DATABASE.md#5-row-level-security-strategy). Rationale: prevents copying, standard for competitive prediction games, unlike the legacy project's single-shared-sheet model.

### Rule editability mid-tournament — RESOLVED: locked at tournament creation (MVP)

`scoring_rules` and bonus/prize configuration cannot be changed once a tournament has been created, for MVP. Simpler and safer — no retroactive scoring disputes, no recalculation-preview machinery needed for Phase 5–7. Revisit post-MVP if real usage demands mid-tournament flexibility (would require the recalculation-preview mechanism described in [SCORING-RULES.md](./SCORING-RULES.md#9-recalculation-and-rule-versioning) to be built out first).

### Tournament creation — RESOLVED: platform owner only (MVP)

Only the platform owner (Oran) can create a new tournament in MVP — no self-serve tournament creation by arbitrary registered users. A created tournament can still have other people assigned as `tournament_admin` by the owner. Revisit if/when the product opens beyond a closed circle. See [PRODUCT.md](./PRODUCT.md#6-permission-matrix-summary).

### Prize tie-break policy — RESOLVED: shared/tied prize

When two or more participants tie for a prize-bearing final rank, the prize is displayed as shared/tied between them — no split logic, no admin-defined tiebreaker criteria for MVP. See [SCORING-RULES.md](./SCORING-RULES.md#8-prize-engine).

### Guest/viewer (read-only) access — RESOLVED: out of scope for MVP

No read-only share link for non-participants in MVP. Can be added later without disrupting the core permission model.

### Data provider strategy for Champions League / Euro — RESEARCHED, risk downgraded

See §3 below for findings. Fixtures/results: **solved** — same provider as the legacy project (football-data.org) already covers both competitions for free. Bonus/statistics (top scorer, assists): **not yet solved**, but the risk is now understood and scoped rather than unknown — see §3.

## 3. Research findings — match data providers for Champions League & Euro (2026-07-22)

**Fixtures & results — de-risked.** football-data.org — the same provider the legacy `world-cup-bets` project already integrates with for World Cup fixtures/results — also covers **UEFA Champions League** and **UEFA European Championship (Euro)** under its free tier ("free forever" for tier-1 competitions, per the provider's own coverage page). This means Phase 4's match-data adapter for a Champions League tournament is very likely a _configuration change_ (different competition code against the same provider/adapter), not a new integration. Confirm the exact competition code and free-tier rate limits against the live API/docs when Phase 4 actually starts (coverage pages describe tiers but not precise rate limits).

**Bonus/statistics data (top scorer, top assists) — still open, but scoped.** The legacy project's bonus-stats feature depends on FIFA's _undocumented_ internal GameDay API (found by inspecting network requests on fifa.com, not from public docs). UEFA.com has an analogous official, interactively-rendered statistics section (`uefa.com/uefachampionsleague/statistics/`) for Champions League top scorers/assists, suggesting a similar internal API likely exists — but no publicly documented one was found via search. Confirming this requires the same hands-on approach used for FIFA (inspect network traffic on uefa.com), which is implementation work, not desk research — deferred to Phase 4. If no such API is found or it proves unreliable, the `bonus_stats` architecture already supports a **manual fallback snapshot** (mirroring the legacy project's `manual_fallback` tier), so a Champions League tournament's bonus categories are never blocked on this — worst case, an admin enters/updates stats manually.

**Net effect:** Champions League as the next tournament is lower-risk than initially flagged in the original open-questions list. World Cup and Euro also both check out on the fixtures/results side via the same provider.

Sources: [football-data.org coverage](https://www.football-data.org/coverage), [football-data.org](https://www.football-data.org/), [UEFA Champions League statistics](https://www.uefa.com/uefachampionsleague/statistics/).

## 4. Remaining open decisions

### Native app-store distribution path

PWA + Capacitor/Expo wrapper vs. a separate native client (see ARCHITECTURE.md §12). Not needed until the product is proven; the only near-term implication is avoiding web-only architectural dead ends. No decision needed yet.

## 5. Risks

- **Provider reliability beyond the World Cup** — downgraded from "unproven" to "partially de-risked" per the research in §3: fixtures/results are covered by the same provider for Champions League and Euro; bonus/statistics equivalent for non-World-Cup competitions is still unconfirmed and needs Phase 4 hands-on investigation, with a manual-fallback safety net already architected in.
- **App-store gambling-policy risk** if prize/points language ever drifts toward money-adjacent framing — needs ongoing discipline in copy and product framing, not just at launch. Reinforced by the naming decision (avoided "betting" for the same reason).
- **RLS complexity** — multi-tenant, multi-role, per-tournament-scoped policies are inherently more complex than the legacy project's no-auth model; under-tested RLS is a realistic source of data leaks between tournaments if rushed. Now made slightly more complex by the "hidden until lock" prediction-visibility decision (§2), which adds a genuinely time-dependent RLS policy rather than a static one.
- **Solo-maintainer capacity** — this is a significantly larger system than the legacy project; phased delivery (ROADMAP.md) exists specifically to manage this risk, and scope creep within a phase is the main threat to it working.
- **Supabase free-tier limits** — fine for a private friends-and-family scale; worth revisiting cost projections before any public/app-store expansion.

## 6. Migration considerations (legacy → new)

Historical participants, predictions, and results from `world-cup-bets` (Google Sheets-backed) are a **possible** Phase 10 import, primarily to (a) preserve history for continuity and (b) cross-check the new scoring engine against known-good legacy output as a correctness validation. This is explicitly optional and not a blocker for launching the new platform's first real tournament — decide the import approach (scripted one-time migration vs. manual re-entry) once Phase 5/6 scoring is proven correct on its own.
