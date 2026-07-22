import type { AdminOverrideEntry, SyncLogEntry } from "./types";
import { matches } from "./matches";

export const syncLogs: SyncLogEntry[] = [
  {
    id: "sl-1",
    timestamp: "2026-07-22T17:05:00+03:00",
    outcome: "success",
    durationMs: 842,
    errorDetail: null,
  },
  {
    id: "sl-2",
    timestamp: "2026-07-22T16:05:00+03:00",
    outcome: "success",
    durationMs: 910,
    errorDetail: null,
  },
  {
    id: "sl-3",
    timestamp: "2026-07-22T15:05:00+03:00",
    outcome: "error",
    durationMs: 3021,
    errorDetail: "Timeout מול football-data.org (מוזג 3 פעמים, הצלחה בניסיון הבא)",
  },
];

export const adminOverrides: AdminOverrideEntry[] = [
  {
    id: "ov-1",
    reason: "תיקון סדר קבוצות (בית/חוץ) שהתקבל הפוך מהספק עבור בורוסיה דורטמונד נגד אינטר",
    enteredBy: "אורן ט.",
    timestamp: "2026-07-12T22:10:00+03:00",
    reversible: true,
  },
];

/** Matches locking within the near future — surfaced on the admin overview. */
export const pendingLockMatches = matches.filter(
  (m) => m.status === "scheduled" && m.homeTeamId !== "",
);

export const lastSyncAt = syncLogs[0]!.timestamp;
export const syncHealth: "healthy" | "degraded" | "failed" = "healthy";
