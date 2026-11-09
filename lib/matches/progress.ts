import type { MatchWithTeams } from "./list";

export function canEditPrediction(match: MatchWithTeams, now: number) {
  return (
    match.status !== "postponed" &&
    match.status !== "cancelled" &&
    (match.retrospectiveEntry === true ||
      (match.status === "scheduled" &&
        new Date(match.lockTime).getTime() > now))
  );
}

export function hasSubmittedPrediction(match: MatchWithTeams) {
  return Boolean(match.ownPrediction && !match.ownPrediction.isDefault);
}

/** Finish missing original entries first; otherwise focus on the next round. */
export function focusMatches(matches: MatchWithTeams[], now: number) {
  const sorted = [...matches].sort((a, b) =>
    a.kickoff.localeCompare(b.kickoff),
  );
  const focus =
    sorted.find((m) => m.retrospectiveEntry && !hasSubmittedPrediction(m)) ??
    sorted.find(
      (m) =>
        m.status === "live" ||
        (m.status === "scheduled" && new Date(m.kickoff).getTime() > now),
    ) ??
    sorted.find((m) => m.retrospectiveEntry) ??
    sorted.at(-1);
  if (!focus) return [];
  return sorted.filter((m) =>
    focus.matchday === null
      ? m.stage === focus.stage && m.matchday === null
      : m.matchday === focus.matchday,
  );
}

export function roundProgress(matches: MatchWithTeams[], now: number) {
  const relevant = matches.filter(
    (m) => m.status !== "cancelled" && m.status !== "postponed",
  );
  const missing = relevant.filter(
    (m) => canEditPrediction(m, now) && !hasSubmittedPrediction(m),
  );
  return {
    total: relevant.length,
    saved: relevant.filter(hasSubmittedPrediction).length,
    missing,
    deadline:
      missing
        .filter((m) => !m.retrospectiveEntry)
        .map((m) => m.lockTime)
        .sort()[0] ?? null,
    retrospective: missing.some((m) => m.retrospectiveEntry),
  };
}
