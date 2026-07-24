/**
 * Friendly display labels for `tournament_providers`/`sync_logs` provider
 * values (ARCHITECTURE.md §6) — falls back to the raw value for any future
 * provider added without a UI update. Shared by the admin overview's sync
 * log (app/(app)/admin/page.tsx) and the diagnostics screen's provider
 * health card + sync log (app/(app)/admin/diagnostics/page.tsx), so the
 * mapping only lives in one place.
 */
export const PROVIDER_LABELS: Record<string, string> = {
  football_data_org: "football-data.org",
  manual: "ידני",
};
