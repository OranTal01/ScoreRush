/**
 * football-data.org -> ScoreRush canonical shape (ARCHITECTURE.md §5).
 *
 * The tricky part is `score.duration`: FD reports `fullTime` as "the score
 * after whatever periods were actually played" — so for a match that went
 * to extra time, `fullTime` is the 120-minute score, not the 90-minute one.
 * The 90-minute score only shows up in `regularTime`, and only when
 * `duration !== "REGULAR"`. We translate that into ScoreRush's explicit,
 * always-90-minutes `regularResult` field so downstream scoring code never
 * has to know FD's quirks.
 */
import type {
  CanonicalMatch,
  CanonicalMatchResult,
  MatchStatus,
  MatchWinner,
  ValidationWarning,
} from "../types";
import { deriveWinner, toMatchScore } from "../normalize";
import type { FDMatch } from "./schema";

const STATUS_MAP: Record<FDMatch["status"], MatchStatus> = {
  SCHEDULED: "scheduled",
  TIMED: "scheduled",
  IN_PLAY: "live",
  PAUSED: "live",
  FINISHED: "finished",
  AWARDED: "finished",
  SUSPENDED: "postponed",
  POSTPONED: "postponed",
  CANCELLED: "cancelled",
};

const WINNER_MAP: Record<"HOME_TEAM" | "AWAY_TEAM" | "DRAW", MatchWinner> = {
  HOME_TEAM: "home",
  AWAY_TEAM: "away",
  DRAW: "draw",
};

export function normalizeFootballDataMatch(
  raw: FDMatch,
  rawPayload: unknown,
): { match: CanonicalMatch; warning: ValidationWarning | null } {
  const status = STATUS_MAP[raw.status];
  const { duration, fullTime, regularTime, extraTime, penalties, winner } =
    raw.score;

  // regularResult/extraTimeResult/penaltyResult are the CANONICAL, final
  // result — they must only ever reflect a match that has actually finished
  // (DATABASE.md: "the ONLY input to prediction scoring"). While a match is
  // still `live`, FD keeps `duration: "REGULAR"` and reports the
  // in-progress score under `fullTime` — that's `liveScore`, not
  // `regularResult`, even though the raw shape looks identical to a
  // finished regular-time match.
  const isFinished = status === "finished";
  const regularResult = isFinished
    ? duration === "REGULAR"
      ? toMatchScore(fullTime)
      : toMatchScore(regularTime)
    : null;
  const extraTimeResult =
    isFinished && (duration === "EXTRA_TIME" || duration === "PENALTY_SHOOTOUT")
      ? (toMatchScore(extraTime) ?? toMatchScore(fullTime))
      : null;
  const penaltyResult =
    isFinished && duration === "PENALTY_SHOOTOUT"
      ? toMatchScore(penalties)
      : null;
  const liveScore = status === "live" ? toMatchScore(fullTime) : null;

  let warning: ValidationWarning | null = null;
  if (status === "finished" && !regularResult) {
    warning = {
      refId: String(raw.id),
      message: `football-data match ${raw.id} is FINISHED but has no regulation-time score — flagged, not guessed`,
    };
  }

  const result: CanonicalMatchResult = {
    status,
    regularResult,
    extraTimeResult,
    penaltyResult,
    liveScore,
    // Trust FD's own winner field first (it already accounts for penalties);
    // fall back to deriving it from the most advanced decisive score we have.
    winner: winner
      ? WINNER_MAP[winner]
      : deriveWinner(penaltyResult ?? extraTimeResult ?? regularResult),
  };

  const match: CanonicalMatch = {
    providerId: String(raw.id),
    // Mechanical lowercasing only — no semantic remapping of FD's stage
    // vocabulary (e.g. "LAST_16" -> "round_of_16") without confirming it
    // against real fixtures first; ARCHITECTURE.md §5 says flag, never guess.
    stage: raw.stage.toLowerCase(),
    group: raw.group ? raw.group.toLowerCase() : null,
    matchday: raw.matchday ?? null,
    homeTeam: {
      providerId: String(raw.homeTeam.id),
      name: raw.homeTeam.name,
      shortName: raw.homeTeam.shortName || raw.homeTeam.name,
    },
    awayTeam: {
      providerId: String(raw.awayTeam.id),
      name: raw.awayTeam.name,
      shortName: raw.awayTeam.shortName || raw.awayTeam.name,
    },
    kickoff: raw.utcDate,
    result,
    rawProviderPayload: rawPayload,
    warning,
  };

  return { match, warning };
}
