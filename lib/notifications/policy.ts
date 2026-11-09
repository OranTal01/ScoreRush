export const defaultPreferences = {
  reminders: true,
  summaries: true,
  kickoff: false,
  finished: false,
  goals: false,
  redCards: false,
};
export function israelDay(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export function reminderWindow(
  now: Date,
  firstLock: Date,
): "day-before" | "same-day" | null {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jerusalem",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  if (hour < 8 || hour >= 23) return null;
  const hours = (firstLock.getTime() - now.getTime()) / 3600000;
  if (hours > 23 && hours <= 24) return "day-before";
  if (hours > 1 && hours <= 2) return "same-day";
  return null;
}
export function isMissingPrediction(
  prediction: { isDefault: boolean } | undefined,
): boolean {
  return !prediction || prediction.isDefault;
}
