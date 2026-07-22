/**
 * A fixed "now" for this static prototype, chosen to land inside matchday 3
 * (see matches.ts): after the live match's kickoff (17:00) and before the
 * next scheduled match's lock time (20:45) on 2026-07-22. Screens read this
 * instead of `Date.now()` so countdowns/relative-time strings render
 * deterministically (including in tests and Playwright snapshots). A real
 * clock arrives with real data in a later phase.
 */
export const MOCK_NOW = new Date("2026-07-22T19:00:00+03:00");

export function formatCountdown(targetIso: string, from: Date = MOCK_NOW): string {
  const diffMs = new Date(targetIso).getTime() - from.getTime();
  if (diffMs <= 0) return "00:00:00";
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatMatchTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
