/**
 * Admin-entered input -> ScoreRush canonical shape. Runs the same score
 * sanity checks the football-data adapter runs, so "manual" never gets a
 * free pass on data quality (ARCHITECTURE.md §6).
 */
import type { MatchScore } from "@/lib/db/schema/competition";
import type {
  CanonicalMatch,
  CanonicalMatchResult,
  ValidationWarning,
} from "../types";
import { deriveWinner, isValidMatchScore } from "../normalize";
import type { ManualMatchInput } from "./schema";

export function normalizeManualMatch(input: ManualMatchInput): {
  match: CanonicalMatch;
  warning: ValidationWarning | null;
} {
  const refId = `${input.homeTeam.name} vs ${input.awayTeam.name} @ ${input.kickoff}`;
  const warnings: string[] = [];

  const checkScore = (
    score: MatchScore | null | undefined,
    label: string,
  ): MatchScore | null => {
    if (!score) return null;
    if (!isValidMatchScore(score)) {
      warnings.push(
        `${label} score (${score.home}-${score.away}) is invalid — dropped, not guessed`,
      );
      return null;
    }
    return score;
  };

  const regularResult = checkScore(input.regularResult ?? null, "regular-time");
  const extraTimeResult = checkScore(
    input.extraTimeResult ?? null,
    "extra-time",
  );
  const penaltyResult = checkScore(input.penaltyResult ?? null, "penalty");
  const liveScore = checkScore(input.liveScore ?? null, "live");

  if (input.homeTeam.name === input.awayTeam.name) {
    warnings.push(
      "home and away team have the same name — likely a data-entry mistake, kept as entered",
    );
  }

  const result: CanonicalMatchResult = {
    status: input.status,
    regularResult,
    extraTimeResult,
    penaltyResult,
    liveScore,
    winner:
      input.winner ??
      deriveWinner(penaltyResult ?? extraTimeResult ?? regularResult),
  };

  const warning: ValidationWarning | null =
    warnings.length > 0 ? { refId, message: warnings.join("; ") } : null;

  const match: CanonicalMatch = {
    providerId: null,
    stage: input.stage,
    group: input.group ?? null,
    matchday: input.matchday ?? null,
    homeTeam: {
      providerId: input.homeTeam.providerId ?? null,
      name: input.homeTeam.name,
      shortName: input.homeTeam.shortName,
    },
    awayTeam: {
      providerId: input.awayTeam.providerId ?? null,
      name: input.awayTeam.name,
      shortName: input.awayTeam.shortName,
    },
    kickoff: input.kickoff,
    result,
    // The admin's own submission IS the "as-received" payload here — same
    // "store as received" principle as a live provider's JSON (ARCHITECTURE.md §5).
    rawProviderPayload: input,
    warning,
  };

  return { match, warning };
}
