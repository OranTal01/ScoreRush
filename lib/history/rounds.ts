import {
  allowsRetrospectiveEntry,
  type OnboardingSettings,
} from "@/lib/tournaments/onboarding";
export type RoundStanding = {
  id: string;
  name: string;
  rank: number;
  total: number;
  roundPoints: number;
  exact: number;
};
export type RoundRecord = {
  key: string;
  label: string;
  capturedAt: string;
  standings: RoundStanding[];
};
export type HistoryMatch = {
  id: string;
  stage: string;
  matchday: number | null;
  kickoff: Date | string;
  status: string;
  regularResult: unknown;
  normalizationStatus: string;
};
const stages: Record<string, string> = {
  group: "שלב הבתים",
  group_stage: "שלב הבתים",
  league_stage: "שלב הליגה",
  playoffs: "פלייאוף",
  playoff: "פלייאוף",
  round_of_16: "שמינית הגמר",
  last_16: "שמינית הגמר",
  quarterfinal: "רבע הגמר",
  quarter_finals: "רבע הגמר",
  semifinal: "חצי הגמר",
  semi_finals: "חצי הגמר",
  final: "הגמר",
  third_place: "מקום שלישי",
};
export function groupRounds(matches: HistoryMatch[]) {
  const grouped = new Map<
    string,
    { key: string; label: string; matches: HistoryMatch[] }
  >();
  for (const match of matches) {
    const key = `${match.stage}:${match.matchday ?? "stage"}`;
    const round = grouped.get(key) ?? {
      key,
      label: `${stages[match.stage] ?? match.stage}${match.matchday !== null ? ` · מחזור ${match.matchday}` : ""}`,
      matches: [],
    };
    round.matches.push(match);
    grouped.set(key, round);
  }
  return [...grouped.values()].sort(
    (a, b) =>
      Math.min(...a.matches.map((m) => +new Date(m.kickoff))) -
      Math.min(...b.matches.map((m) => +new Date(m.kickoff))),
  );
}
export function roundIsSettled(
  matches: HistoryMatch[],
  settings: OnboardingSettings,
) {
  const played = matches.filter((m) => m.status !== "cancelled");
  return (
    played.length > 0 &&
    played.every(
      (m) =>
        m.status === "finished" &&
        m.regularResult !== null &&
        m.normalizationStatus === "normalized" &&
        !allowsRetrospectiveEntry(settings, m),
    )
  );
}
/** A round first observed after completion has no trustworthy historical rank.
 * Only a transition observed by this feature may create a historical snapshot. */
export function shouldCaptureRound(
  trackedOpen: boolean,
  capturedAt: unknown,
  settled: boolean,
  fullyScored: boolean,
) {
  return trackedOpen && !capturedAt && settled && fullyScored;
}
export function roundWinners(standings: RoundStanding[]) {
  if (!standings.length) return [];
  const best = Math.max(...standings.map((p) => p.roundPoints));
  return standings.filter((p) => p.roundPoints === best);
}
