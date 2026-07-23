/**
 * Shared provider-adapter contracts (ARCHITECTURE.md §5-6).
 *
 * Every match-data source — football-data.org, a future UEFA bonus-stats
 * source, or an admin typing scores into a form — implements the same
 * `MatchDataAdapter` interface and produces the same `CanonicalMatch` shape.
 * Normalization/scoring code downstream never knows which concrete provider
 * produced the data.
 *
 * Pipeline this module supports (ARCHITECTURE.md §5):
 *   Provider response -> raw storage -> validation -> normalization ->
 *   canonical match result -> prediction scoring
 *
 * This module only covers "raw storage -> validation -> normalization ->
 * canonical result." Prediction scoring is Phase 5.
 */
import type { matchStatusEnum } from "@/lib/db/schema/enums";
import type { MatchScore } from "@/lib/db/schema/competition";

export type MatchStatus = (typeof matchStatusEnum.enumValues)[number];

export type MatchWinner = "home" | "away" | "draw" | null;

/** A team as referenced by a match, before it's resolved to an internal `teams.id` row. */
export interface CanonicalTeamRef {
  /** External provider's team id, stringified — null for manual/custom-tournament teams. */
  providerId: string | null;
  name: string;
  shortName: string;
}

/**
 * The canonical result shape (ARCHITECTURE.md §5): regular/extra-time/penalty
 * results are distinct fields, never conflated. `regularResult` is the ONLY
 * input to prediction scoring (SCORING-RULES.md §3); `penaltyResult` is never
 * counted for scoring OR tournament statistics.
 */
export interface CanonicalMatchResult {
  status: MatchStatus;
  /** Canonical 90-minute + stoppage result. Null until at least regulation time has finished. */
  regularResult: MatchScore | null;
  /** Present only for knockout matches that went past 90 minutes. */
  extraTimeResult: MatchScore | null;
  /** Never used for prediction scoring or tournament statistics. */
  penaltyResult: MatchScore | null;
  /** In-progress score while `status === "live"`; null otherwise. */
  liveScore: MatchScore | null;
  winner: MatchWinner;
}

/** One match, normalized to ScoreRush's canonical shape — ready to upsert into `matches`. */
export interface CanonicalMatch {
  /** External provider's match id, stringified — null for manually-entered matches. */
  providerId: string | null;
  stage: string;
  group: string | null;
  matchday: number | null;
  homeTeam: CanonicalTeamRef;
  awayTeam: CanonicalTeamRef;
  /** ISO 8601 timestamp. */
  kickoff: string;
  result: CanonicalMatchResult;
  /**
   * As-received provider payload for this match, stored immutably alongside
   * the canonical result (ARCHITECTURE.md §5) — `unknown` because each
   * provider's raw shape differs; consumers must not parse this directly,
   * only archive/display it for diagnostics.
   */
  rawProviderPayload: unknown;
  /**
   * Set when this specific match was flagged during normalization (a sanity
   * check failed but the match wasn't dropped) — carried on the match
   * itself, not just the batch-level `AdapterFetchResult.warnings` list, so
   * the DB write layer can set `matches.normalization_status` /
   * `matches.warning_flag` per row without re-deriving which warning
   * belongs to which match.
   */
  warning: ValidationWarning | null;
}

/** A shape/sanity problem found during validation — the match is flagged, not silently dropped or guessed at. */
export interface ValidationWarning {
  /** Provider's raw match id (or another stable identifier) this warning applies to. */
  refId: string;
  /** e.g. "team order reversed vs. expected" (DATABASE.md §3) — human-readable, shown in admin diagnostics. */
  message: string;
}

/**
 * Result of a single adapter fetch+normalize cycle. Always returns whatever
 * matches it could successfully normalize, plus warnings for anything it
 * couldn't — a provider failure on some matches must never erase valid data
 * for the others (ARCHITECTURE.md §5).
 */
export interface AdapterFetchResult {
  matches: CanonicalMatch[];
  warnings: ValidationWarning[];
}

/**
 * Config stored per-tournament in `tournament_providers.match_data_config`
 * (or `.bonus_stats_config`) — shape is adapter-specific, hence `unknown` at
 * this layer; each adapter narrows/validates its own config.
 */
export type ProviderConfig = Record<string, unknown>;

/**
 * Shared interface every match-data provider implements (ARCHITECTURE.md
 * §6) — the football-data.org adapter, the manual adapter, and any future
 * provider all conform to this so the sync job and normalization/scoring
 * layers never branch on provider identity.
 */
export interface MatchDataAdapter {
  /** Matches `tournament_providers.match_data_provider` — e.g. "football_data_org" | "manual". */
  readonly providerName: string;
  /**
   * Fetches raw data from the provider (or reads admin-entered rows, for the
   * manual adapter) and normalizes it to the canonical shape in one call.
   * Validation happens internally; validation failures become `warnings`
   * entries rather than thrown errors, except when the fetch itself fails
   * (network error, non-2xx response, malformed envelope) — those throw, so
   * the caller can apply the "fall back to last-known-good data" policy
   * required by ARCHITECTURE.md §5.
   */
  fetchMatches(config: ProviderConfig): Promise<AdapterFetchResult>;
}

/**
 * One ranked entity in a resolved bonus-stat snapshot — e.g. one player's
 * goal tally for a "Top Scorer" category (DATABASE.md `bonus_stats`,
 * SCORING-RULES.md §6). `rank` is pre-computed here (not left to the DB
 * write layer) because computing it correctly — equal values must share
 * equal rank — requires seeing the whole sorted list at once, which is
 * exactly what normalization already has in hand.
 */
export interface CanonicalBonusStatEntry {
  /** Provider's raw id for this player/team, stringified — null for a manual entry with no stable id. */
  refId: string | null;
  label: string;
  value: number;
  /** Competition ranking (1,2,2,4 — ties share a rank, next distinct value skips accordingly), per SCORING-RULES.md §6. */
  rank: number;
}

/**
 * One resolved stat list (e.g. all entries for "Top Scorer"). `statKey` is
 * an adapter-assigned identifier ("top_scorer" | "top_assists" | ...) for
 * whoever wires this into a tournament's `bonus_categories` — matching a
 * `statKey` to a specific category is a deliberate admin/operator decision
 * (Phase 4 admin UI), never guessed by inferring category names.
 */
export interface CanonicalBonusStatResult {
  statKey: string;
  entries: CanonicalBonusStatEntry[];
}

/** Result of one bonus-stats adapter fetch+normalize cycle — mirrors `AdapterFetchResult`'s "never erase valid data on partial failure" contract. */
export interface BonusStatsFetchResult {
  stats: CanonicalBonusStatResult[];
  warnings: ValidationWarning[];
}

/**
 * Shared interface every bonus-stats provider implements — deliberately
 * separate from `MatchDataAdapter` because `tournament_providers` configures
 * match data and bonus stats independently (`match_data_provider` /
 * `bonus_stats_provider` are distinct columns, DATABASE.md): a tournament
 * can use football-data.org for fixtures but "manual" for bonus stats, or
 * vice versa.
 */
export interface BonusStatsAdapter {
  /** Matches `tournament_providers.bonus_stats_provider` — e.g. "football_data_org" | "manual". */
  readonly providerName: string;
  fetchBonusStats(config: ProviderConfig): Promise<BonusStatsFetchResult>;
}
