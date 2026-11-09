export type OnboardingSettings = {
  onboarding_open?: boolean;
  onboarding_matchday?: number;
  onboarding_closes_at?: string | Date | null;
};
export function allowsRetrospectiveEntry(
  settings: OnboardingSettings | null | undefined,
  match: { matchday?: number | null; stage?: string; status?: string },
  now = Date.now(),
) {
  const closesAt = settings?.onboarding_closes_at;
  return (
    settings?.onboarding_open === true &&
    (!closesAt || new Date(closesAt).getTime() > now) &&
    match.matchday != null &&
    match.matchday <= (settings.onboarding_matchday ?? 1) &&
    ["group", "group_stage", "league_stage"].includes(match.stage ?? "") &&
    !["cancelled", "postponed"].includes(match.status ?? "")
  );
}
