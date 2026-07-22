# SCORING-RULES.md

Status: Phase 0 planning document. Describes the intended scoring/bonus/prize _engine_ (configurable), seeded with the proven defaults from the legacy project. Not yet implemented.

## 1. Design principle

Every number in this document is a **default**, not a constant. The legacy project (`world-cup-bets`) hardcodes 9/6/3/0 and fixed bonus point values for a single World Cup tournament. This system stores the same values as the out-of-the-box default `scoring_rules`/`bonus_categories`/`bonus_slots` configuration for a new tournament, but a tournament admin can change every one of them per tournament, without a code change.

## 2. Match prediction scoring (configurable)

Default point values (validated in production by the legacy project):

| Outcome                                  | Default points |
| ---------------------------------------- | -------------- |
| Exact score                              | 9              |
| Correct winner + correct goal difference | 6              |
| Correct winner only                      | 3              |
| Wrong winner                             | 0              |

Example (unchanged from the legacy rules): if the actual result is 3–2 and a participant predicted 2–1 for the same winner, that's a correct winner + correct goal difference → 6 points.

All four values are per-tournament `scoring_rules` fields, editable by the tournament admin before rules are locked (see §9).

## 3. Knockout-specific rules

- Match prediction scoring uses **only the result after 90 minutes plus stoppage time**.
- Extra time never counts for prediction scoring.
- Penalty shootout kicks never count for prediction scoring.

These are treated as fixed platform-level truths (not admin-configurable) because they reflect what "predicting a match" means, not a scoring preference — same stance as the legacy project.

## 4. Tournament statistics scoring window

- Tournament-wide statistics (e.g. top scorer, top assists) may include goals/contributions through **120 minutes**.
- Penalty shootout kicks never count, in statistics either.

This mirrors the legacy project's separation between "prediction scoring result" and "tournament statistics result" — they are computed from the canonical match result but are not the same number.

## 5. Group ranking scoring

- Default: 3 points for every exact team position correctly predicted within a group.
- Group ranking points are added to a participant's total **only after the entire group stage is complete** — never partially, to avoid rewarding a lucky partial guess before the group is settled.
- Point value per exact position is a `scoring_rules` field, admin-configurable per tournament (some tournaments may not have groups at all, e.g. a knockout-only cup — in that case group ranking is simply absent from that tournament's configuration).

## 6. Bonus category engine

Generalizes the legacy project's fixed bonus categories (Top Scorer, Top Assists, Top Scoring Team, Champion, Runner-up) into an admin-configurable set:

- A tournament has zero or more `bonus_categories`. Defaults for a World Cup-style tournament mirror the legacy set; a Champions League or custom tournament may define different categories entirely.
- Each category has one or more `bonus_slots` a participant fills with a pick (player/team/entity, depending on category type). Default pattern (from the legacy project): 3 slots per category, worth 20 / 10 / 10 points respectively.
- **Duplicate picks are allowed and stack by default** (configurable per category) — e.g. picking the same player in all three slots and that player winning yields 20 + 10 + 10 = 40 points, exactly as validated in the legacy project.
- Bonus resolution must always use **one single resolved stats/winners snapshot**, reused identically across the bonus breakdown, `bonusPoints`, `totalPoints`, tournament leader cards, and bonus detail tables — never independently fetched per surface. This is a hard carry-over rule from the legacy FIFA bonus-stats provider design, generalized to whatever stats source a tournament is bound to.
- Winner determination: only first place counts, **including ties** — determine winners by maximum numeric value, not just "first item in a list"; equal values must display equal rank.

## 7. Terminal categories (champion/runner-up pattern, generalized)

Categories that can only be correctly known once the tournament concludes (e.g. Champion, Runner-up) must remain **excluded from `bonusPoints` and `totalPoints`** until the real outcome is known — never guessed, never partially credited. This "terminal bonus category" behavior is a property a `bonus_categories` entry can declare (`resolves_at: "tournament_end"` vs. `resolves_at: "ongoing"`), rather than being hardcoded to exactly champion/runner-up as in the legacy project.

## 8. Prize engine

- A tournament has zero or more `prizes`, each tied to a final leaderboard rank (1st, 2nd, 3rd, ... Nth).
- A prize is a **free-text/structured description**, not a monetary transaction the app processes — the app never handles real money. This is a deliberate product and app-store-policy boundary (see [PRODUCT.md](./PRODUCT.md#3-what-this-is-not)).
- Prizes are revealed/displayed against the final leaderboard once the tournament reaches a terminal state (final match resolved, champion/runner-up determined, no more matches pending).
- **Resolved:** when two or more participants tie for a prize-bearing rank, the prize is displayed as shared/tied between them. No prize-splitting logic and no admin-defined tiebreaker criteria for MVP — see [DECISIONS.md](./DECISIONS.md).

## 9. Recalculation and rule versioning

- `totalPoints = matchPoints + groupRankingPoints + bonusPoints`, always. The leaderboard and bonus table must always agree — same rule as the legacy project, now enforced across configurable rule sets instead of one fixed set.
- Because rules are editable, a `scoring_rules` change (or a match-result correction) triggers an explicit **recalculation preview** (admin-only screen) before being applied — the admin sees the leaderboard delta before committing, rather than scores silently shifting.
- **Resolved:** for MVP, rules are **locked at tournament creation** and cannot be edited after scoring has begun — see [DECISIONS.md](./DECISIONS.md). The recalculation-preview mechanism described above still applies to the one legitimate case that remains: correcting a match result (e.g. a provider correction or a manual override), which is not a rules change. Mid-tournament rule editing itself is deferred post-MVP.

## 10. Hebrew terminology (mandatory, carried over from the legacy project)

Never use **קלע / קלעה**. Use:

- כבש / הבקיעה — scored a goal
- מלך השערים / מלך הבישולים — top scorer / top assist provider
- הנבחרת המבקיעה ביותר — top scoring team
- ניחש תוצאה מדויקת — predicted the exact score
- ניחש את המנצחת ואת הפרש השערים — predicted the winner and goal difference
- ניחש את המנצחת — predicted the winner
- ניחש נכון שהמשחק יסתיים בתיקו — correctly predicted a draw
- התחזית לא תאמה את תוצאת המשחק — wrong prediction
- עלה בדירוג / ירד בדירוג — moved up/down the ranking
- צבר X נקודות — accumulated X points

These strings live in a typed content module (not hardcoded per-component) so they stay consistent across the leaderboard, activity feed, notifications, and match detail explanations — same discipline as the legacy project's `shared/content/he.ts`.
