# ARCHITECTURE.md

Status: Phase 0 planning document. No project has been initialized, no packages installed, no database created.

## 1. Stack summary

| Layer                  | Choice                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Framework              | Next.js (App Router), React, TypeScript (strict mode)                                               |
| Styling                | Tailwind CSS                                                                                        |
| Data fetching / cache  | TanStack Query (client), Server Components/route handlers (server)                                  |
| Database               | PostgreSQL via Supabase                                                                             |
| ORM                    | Drizzle                                                                                             |
| Auth                   | Supabase Auth (Google OAuth + magic link)                                                           |
| Validation             | Zod (shared between client forms and server boundaries)                                             |
| Storage                | Supabase Storage (avatars, future assets)                                                           |
| Testing                | Vitest (unit/domain), Testing Library (components), Playwright (e2e)                                |
| Deployment             | Vercel                                                                                              |
| Notifications (future) | Email now-ish; push/PWA later; official WhatsApp Cloud API later — **not** a local WhatsApp Web bot |

## 2. Layered architecture

```
Presentation (Next.js App Router, React Server + Client Components)
        ↓
Application layer (server actions / route handlers — orchestration only)
        ↓
Domain/service layer (scoring, normalization, leaderboard aggregation — pure, framework-agnostic, unit-testable)
        ↓
Data access layer (Drizzle repositories)
        ↓
PostgreSQL (Supabase)
```

Hard rule carried over from the legacy project's proven pattern: **UI components never interpret raw provider payloads and never perform domain calculations.** Components render view models produced by the domain/service layer.

## 3. Multi-tenancy model

One platform serves many tournaments and many participants. A user account is platform-global; membership, role, predictions, and points are always scoped to a specific tournament via a `participants`/membership record. No cross-tournament data leaks into a participant's view of a tournament they are not a member of. See [DATABASE.md](./DATABASE.md#5-row-level-security-strategy) for the enforcement mechanism (Postgres RLS, not just application-level checks).

## 4. Auth architecture

- Supabase Auth handles identity: Google OAuth and magic-link email sign-in. No self-managed passwords.
- Account creation (identity) is separate from tournament membership (authorization). Signing in does not grant access to any tournament by itself.
- Tournament access is granted only via an **invitation** (token-based invite link), consumed once, tied to a specific tournament and optionally a specific email.
- Role (`platform_admin`, `tournament_admin`, `participant`) is resolved per tournament from the membership record, not from a single global role flag (a user can be admin of one tournament and a plain participant in another).

## 5. Provider data pipeline

This is the single most important architectural rule carried over from the legacy project, generalized for multiple providers/competitions:

```
Provider response (external API)
        ↓
Raw provider storage (stored as-received, immutable, timestamped)
        ↓
Validation (shape/sanity checks; reject or flag, never guess)
        ↓
Match result normalization (provider-specific → canonical shape)
        ↓
Canonical match result (90-minute result for predictions; up-to-120-minute result for tournament stats; penalties never counted)
        ↓
Prediction scoring (pure function of canonical result + tournament's scoring rules)
        ↓
Leaderboard aggregation (+ snapshotting for rank-movement history)
        ↓
UI view models
```

Non-negotiable properties:

- A provider failure must **never silently erase** valid last-known data — fall back to the last-known-good normalized result, surface a visible data-freshness indicator, never render an empty/zeroed leaderboard.
- Raw provider data, canonical 90-minute prediction result, canonical tournament-stat result, and display result are **distinct, separately stored/derived concepts** — never conflated in one field.
- Manual overrides are last-resort, logged, reasoned, attributed, timestamped, and reversible (`admin_overrides`, `score_audit_logs` — see [DATABASE.md](./DATABASE.md)).

## 6. Provider adapter pattern

Unlike the legacy project (one tournament, one Google Sheet, one fixed FIFA stats integration), this system must support **different data sources per competition**:

- World Cup, Champions League, Euro — fixtures/results are all confirmed covered by football-data.org's free tier (same provider the legacy project already uses), per the research logged in [DECISIONS.md](./DECISIONS.md#3-research-findings--match-data-providers-for-champions-league--euro-2026-07-22). One adapter, different competition code per tournament — not a separate integration per competition.
- Bonus/statistics data (top scorer, top assists, top team) — solved for World Cup via the legacy hybrid FIFA GameDay provider pattern; for Champions League/Euro, an equivalent official-but-undocumented source is suspected (UEFA.com has an analogous statistics page) but not yet confirmed — requires the same hands-on network-inspection approach in Phase 4, with manual-entry fallback always available as a safety net.
- Custom tournaments — no external provider; admin enters matches/results manually through the admin UI.

Each tournament binds to a `tournament_providers` configuration (see [DATABASE.md](./DATABASE.md)) selecting which adapter(s) supply match schedules/results and, separately, which adapter (if any) supplies bonus/statistics data. Adapters implement a shared interface so the normalization/scoring layers never know which concrete provider produced the raw data. A "manual provider" (admin-entered data, going through the same validation/normalization path) is a first-class adapter, not a special case.

## 7. Scheduled sync & background jobs

Match schedule/result sync and bonus-stats refresh run on a schedule (Vercel Cron hitting a route handler, or Supabase Edge Functions/`pg_cron`, decision left to Phase 4 implementation). Sync runs are logged (`sync_logs`) with outcome, duration, and error detail, independent of whether the run changed any data.

## 8. Notifications architecture (future)

Not in MVP scope (Phase 8). Planned order: email (transactional, e.g. via Resend or Supabase's built-in email) → push notifications via installed PWA → official WhatsApp Cloud API integration once the product justifies it. The legacy project's local `whatsapp-web.js` bot (requires an open terminal, a persisted browser session, manual restarts) is explicitly **not** an acceptable long-term pattern for this system — it may inform _what_ messages to send, never _how_ they're delivered.

## 9. Testing strategy

- **Vitest** for the domain/service layer: scoring, normalization, leaderboard aggregation, provider adapters (contract tests against fixture payloads) — this is where correctness is proven, independent of UI.
- **Testing Library** for component-level behavior (states, accessibility, interaction).
- **Playwright** for end-to-end flows (login → join → predict → see score) and responsive/visual checks at the breakpoints defined in [UX-BLUEPRINT.md](./UX-BLUEPRINT.md).
- Every phase in [ROADMAP.md](./ROADMAP.md) ends with a green test suite, not just "code that compiles."

## 10. Observability & audit

`sync_logs`, `system_events`, `score_audit_logs`, and `admin_overrides` together form the audit trail. Any value a participant sees that was influenced by a human decision (not pure computation from provider data) must be traceable to a specific logged override. This is a trust requirement, not a nice-to-have — disputes about scoring must be resolvable by looking at logs, not by trusting memory.

## 11. Deployment & environments

Vercel for hosting (mirroring the legacy project's proven setup). The original plan called for separate Supabase projects (or at minimum clearly separated schemas) for local/dev, preview, and production; in practice, Phase 10 reused the single `scorerush-dev` Supabase project for both dev and production to avoid additional infra cost for a solo-maintainer launch — see [DEVELOPMENT.md §3](./DEVELOPMENT.md#3-deviation-from-architecturemd-11-one-shared-supabase-project-not-per-environment) for the accepted risk and the trigger for revisiting it. Environment variables (Supabase keys, provider API keys/tokens) follow the same "server-side only, never logged, never returned in API responses" discipline established for the legacy project's FIFA token handling. See [DEVELOPMENT.md](./DEVELOPMENT.md) for the live hosting setup, deploy commands, and known gotchas.

## 12. Future native distribution

Deferred decision, tracked in [DECISIONS.md](./DECISIONS.md). Two realistic paths once the product is proven:

1. **PWA + thin native wrapper** (Capacitor or Expo) around the same Next.js app — lowest incremental cost, reuses 100% of the web codebase.
2. **Separate native client** (React Native or platform-native) consuming the same backend/API — higher cost, better native feel.

The architecture should avoid web-only assumptions that would make path 1 impossible later (e.g. keep push-notification and storage access behind an abstraction rather than raw browser APIs sprinkled through components).

## 13. Non-functional requirements

- **Resilience:** provider/network failures degrade gracefully; the system prefers stale-but-correct data over fresh-but-wrong or empty data.
- **Security:** RLS-enforced tenant isolation (not just app-layer checks); no secrets in client bundles or logs; invitation tokens are single-use and expirable.
- **Performance:** leaderboard and dashboard reads should be fast even as tournaments accumulate matches/participants — snapshotting/aggregation strategy is defined in [DATABASE.md](./DATABASE.md) precisely to avoid recomputing full history on every read.
- **Maintainability:** this is built and maintained primarily by one developer with AI assistance — architecture favors clear, testable, small units over cleverness.
