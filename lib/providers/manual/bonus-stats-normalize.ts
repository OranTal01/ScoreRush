/**
 * Admin-entered bonus-stat input -> ScoreRush canonical shape. Runs the same
 * competition-ranking helper the football-data adapter uses, so a manually
 * entered category ranks identically to a live-fetched one (ARCHITECTURE.md
 * §6 — manual never gets a free pass on data quality or a different rule).
 */
import { rankByValue } from "../normalize";
import type { CanonicalBonusStatResult, ValidationWarning } from "../types";
import {
  manualBonusStatEntryInputSchema,
  type ManualBonusStatInput,
} from "./bonus-stats-schema";

export function normalizeManualBonusStat(input: ManualBonusStatInput): {
  result: CanonicalBonusStatResult;
  warnings: ValidationWarning[];
} {
  const warnings: ValidationWarning[] = [];
  const validEntries: { refId: string | null; label: string; value: number }[] =
    [];

  input.entries.forEach((entry, index) => {
    const parsed = manualBonusStatEntryInputSchema.safeParse(entry);
    if (!parsed.success) {
      warnings.push({
        refId: `${input.statKey}-entry-${index}`,
        message: `manual bonus-stat entry for "${input.statKey}" failed shape validation, dropped: ${parsed.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      });
      return;
    }
    validEntries.push({
      refId: parsed.data.refId ?? null,
      label: parsed.data.label,
      value: parsed.data.value,
    });
  });

  return {
    result: { statKey: input.statKey, entries: rankByValue(validEntries) },
    warnings,
  };
}
