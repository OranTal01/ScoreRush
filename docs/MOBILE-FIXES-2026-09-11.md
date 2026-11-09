# Mobile fixes — 11 September 2026

Deployed to https://scorerush-sigma.vercel.app as `dpl_AAtWTpjktm2zAAiAtuRNuy6oPJ56` (READY).

## User-reported issues

1. Rank circles: removed display override from `.ltr`; badges retain flex centering. Live computed styles confirm 20×20, centered both axes.
2. Added profile nickname editing for the authenticated participant in the active tournament. Validates 1–32 characters, checks existing names, writes only display name/initials, refreshes the layout. Auth/duplicate/ownership tests pass. No live nickname was changed.
3. Saved band predictions now open as a summary. Explicit Edit button reveals the form with existing selections. After a successful save it collapses again. Existing server-rendered locked state remains read-only.
4. Ranking structure stays protected after predictions exist. Added prominent explanation; scoring points and deadline remain editable. Bonus types/slots similarly remain protected once used. No existing selections were deleted or reinterpreted.
5. Replaced datetime-local controls with separate date/time fields, preserving Israel-time conversion. Live at 320px all date/time controls fit within their cards.
6. Bonus submission now uses a same-origin POST endpoint with existing authentication/ownership/lock checks, returns JSON without full-page rendering, and bounds server requests to 20 seconds/client waiting to 30 seconds. Network errors preserve choices and release the button; success clears when editing. Before the fix the user's four assist picks were already persisted. Live verification re-saved those identical picks and received `נשמר` successfully.
7. Podium no longer finds only one participant per rank. Both members sharing 60 points appear as joint first with explanatory text. Ranking math is unchanged; no fictitious third participant.
8. Match search and matchday selector have explicit 48px height and equal top coordinates. Native select appearance normalized for mobile.

## Validation

- 278 tests passed, one optional database integration test skipped.
- Lint, TypeScript, local production build, and Vercel build passed.
- Live authenticated checks: leaderboard, group summary/table, profile editor, predictions controls, assist-bonus save, and settings editing.
- Browser viewport checks at 390 and 320px. Physical iPhone verification remains for the user.
- Old-deployment logs showed settings GET timeouts (300 seconds); a read-only database check found no blocked queries at inspection. Final-deployment settings loaded successfully during verification. No claim of a proven root cause for those historical timeouts.

The deployed source remains this worktree, `/Users/oran/.codex/worktrees/c2f8/ScoreRush`; changes are uncommitted. Preserve it when integrating into the Desktop checkout. No migrations or tournament configuration changes were applied.
