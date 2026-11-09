import {
  allowsRetrospectiveEntry,
  type OnboardingSettings,
} from "@/lib/tournaments/onboarding";
export type ContinuationMatch = {
  id: string;
  tournament_id: string;
  stage: string;
  matchday: number | null;
  kickoff: string;
  lock_time: string;
  status: string;
  tournaments: OnboardingSettings | null;
};
export type PredictionContinuation = {
  nextMatchId: string | null;
  remaining: number;
};
export function nextPrediction(
  current: Pick<
    ContinuationMatch,
    "id" | "tournament_id" | "stage" | "matchday"
  >,
  matches: ContinuationMatch[],
  picks: { match_id: string; is_default: boolean }[],
  now: number,
): PredictionContinuation {
  const submitted = new Set(
    picks.filter((p) => !p.is_default).map((p) => p.match_id),
  );
  const round = matches
    .filter(
      (m) =>
        m.tournament_id === current.tournament_id &&
        m.stage === current.stage &&
        m.matchday === current.matchday,
    )
    .sort(
      (a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id),
    );
  const index = round.findIndex((m) => m.id === current.id);
  const ordered =
    index < 0 ? round : [...round.slice(index + 1), ...round.slice(0, index)];
  const missing = ordered.filter(
    (m) =>
      m.id !== current.id &&
      !submitted.has(m.id) &&
      !["cancelled", "postponed"].includes(m.status) &&
      (allowsRetrospectiveEntry(m.tournaments, m) ||
        (m.status === "scheduled" && Date.parse(m.lock_time) > now)),
  );
  return { nextMatchId: missing[0]?.id ?? null, remaining: missing.length };
}
