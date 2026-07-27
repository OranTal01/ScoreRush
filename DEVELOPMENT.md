# DEVELOPMENT.md

Status: Phase 10 (Migration & launch) infrastructure reference. Documents how ScoreRush is actually hosted and deployed, and the decisions behind it — see [DECISIONS.md](./DECISIONS.md) for the decision log and [ARCHITECTURE.md](./ARCHITECTURE.md#11-deployment--environments) for the originally-planned architecture this deviates from in one respect (§3 below).

## 1. Environments & hosting

- **Production**: Vercel project `scorerush`, inside the **World Cup Friends** team — a sibling project to `tal-family-os`, fully separate from `world-cup-bets` (no shared code, settings, env vars, or data).
  - Live URL: **https://scorerush-sigma.vercel.app**
  - Also aliased (same deployment, use the URL above as canonical): `scorerush-world-cup-friends.vercel.app`, `scorerush-orantal01-9207-world-cup-friends.vercel.app`
  - Note: `scorerush.vercel.app` (no suffix) is **not** ours — a pre-existing, unrelated third-party site already held that subdomain before this project was created, which is why Vercel assigned the suffixed alias instead.
- **Local dev**: `npm run dev` against `.env.local` (gitignored; see `.env.example` for the variable list).
- **Database**: Supabase project `scorerush-dev` (ref `yxnzukupayrhzwnbqibu`, region `ap-southeast-2`) is reused for **both** local/dev and production. See §3.

## 2. Why the Vercel project lives inside "World Cup Friends"

The original intent was to host `scorerush` under a personal Vercel scope, fully separate from the "World Cup Friends" team that hosts `world-cup-bets` and `tal-family-os`. That path turned out to be technically unavailable: this Vercel account has no standalone personal scope — `vercel switch <username>` returns `personal_scope_not_allowed`. Every Vercel account gets exactly one default Hobby-tier team that functions as its personal scope, and on this account that team is literally named "World Cup Friends" (created originally for the legacy project). Creating a second team is possible but requires the dashboard/API (no CLI subcommand) and wasn't judged worth the overhead for a solo-maintainer project.

Decision: place `scorerush` inside "World Cup Friends" as an independent project, the same way `tal-family-os` already coexists there — sharing only the team/billing scope, nothing else. `world-cup-bets` itself was not touched or reconfigured in any way during this work.

## 3. Deviation from ARCHITECTURE.md §11: one shared Supabase project, not per-environment

ARCHITECTURE.md §11 originally called for separate Supabase projects (or at least clearly separated schemas) per environment, so migrations and test data never touch real tournament data. In practice, for this solo-maintainer project's first real launch, `scorerush-dev` is reused as **both** the dev and production database — no second Supabase project was created.

Rationale: zero additional cost, zero additional infra to keep in sync, and immediately available. Accepted risk: schema migrations and any local seed/test data now directly affect the production dataset — migrations must be applied carefully (review before running against this project), and no throwaway test data should be left in it going forward. Revisit (create a dedicated `scorerush-prod` project) if usage grows beyond a small private circle or the shared-DB risk becomes a real problem in practice.

## 4. Deploying

```bash
# One-time per machine: link the local checkout to the Vercel project
npx vercel link --yes --scope world-cup-friends --project scorerush

# Deploy to production
npx vercel deploy --prod --scope world-cup-friends
```

`.vercel/project.json` (created by `link`) and `.env.local` are both gitignored — a fresh clone needs `vercel link` re-run once before deploying.

Env vars are managed with `vercel env add <NAME> production --scope world-cup-friends` (value piped via stdin, never passed as a CLI flag, to keep it out of shell history) and mirror the variables in `.env.local` / `.env.example`. Verify with `vercel env ls production --scope world-cup-friends`.

## 5. Known gotchas

- **New Vercel projects created via `vercel project add` do not get an auto-detected framework preset.** The interactive first-time `vercel` flow normally detects "Next.js" automatically; the non-interactive `project add` path used here skipped that, leaving the project's framework preset `null`. Effect: the build succeeds completely (all routes compiled, deployment `READY`), but every URL 404s at Vercel's edge, because routing never learns to map requests to the Next.js Lambda output. Fix (already applied): `vercel project update scorerush --framework nextjs --scope world-cup-friends`, then redeploy — the setting is not retroactive, a fresh deploy is required after changing it. Documented here so this isn't rediscovered blind if the project is ever recreated.
- **Deployment Protection (SSO) is on by default** for new projects in the "World Cup Friends" team (`all_except_custom_domains`). Disabled for `scorerush` via `vercel project protection disable scorerush --sso --scope world-cup-friends`, since there's no custom domain and no preview deployments yet (no git integration connected). Revisit if preview deployments or a custom domain are added later — the CLI only supports a blanket on/off toggle; a granular "previews only" setting would require a direct Vercel API call.
