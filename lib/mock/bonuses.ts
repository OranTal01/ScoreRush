import type { BonusCategory, BonusLeaderEntry, BonusPrediction } from "./types";
import { currentParticipantId } from "./participants";

/**
 * Default bonus category set per SCORING-RULES.md §6 — mirrors the legacy
 * project's fixed categories (Top Scorer, Top Assists, Top Scoring Team,
 * Champion, Runner-up), here as admin-configurable `bonus_categories` rows.
 * Champion/Runner-up are "terminal" categories (§7): excluded from points
 * until the tournament actually concludes.
 */
export const bonusCategories: BonusCategory[] = [
  {
    id: "bc-top-scorer",
    name: "מלך השערים",
    type: "player",
    resolvesAt: "ongoing",
    duplicateStackingAllowed: true,
    slots: [
      { id: "bc-top-scorer-1", index: 1, points: 20 },
      { id: "bc-top-scorer-2", index: 2, points: 10 },
      { id: "bc-top-scorer-3", index: 3, points: 10 },
    ],
  },
  {
    id: "bc-top-assists",
    name: "מלך הבישולים",
    type: "player",
    resolvesAt: "ongoing",
    duplicateStackingAllowed: true,
    slots: [
      { id: "bc-top-assists-1", index: 1, points: 20 },
      { id: "bc-top-assists-2", index: 2, points: 10 },
      { id: "bc-top-assists-3", index: 3, points: 10 },
    ],
  },
  {
    id: "bc-top-team",
    name: "הנבחרת המבקיעה ביותר",
    type: "team",
    resolvesAt: "ongoing",
    duplicateStackingAllowed: true,
    slots: [
      { id: "bc-top-team-1", index: 1, points: 20 },
      { id: "bc-top-team-2", index: 2, points: 10 },
      { id: "bc-top-team-3", index: 3, points: 10 },
    ],
  },
  {
    id: "bc-champion",
    name: "אלופה",
    type: "team",
    resolvesAt: "tournament_end",
    duplicateStackingAllowed: false,
    slots: [{ id: "bc-champion-1", index: 1, points: 40 }],
  },
  {
    id: "bc-runner-up",
    name: "מקום שני",
    type: "team",
    resolvesAt: "tournament_end",
    duplicateStackingAllowed: false,
    slots: [{ id: "bc-runner-up-1", index: 1, points: 30 }],
  },
];

/**
 * `me`'s picks. `bc-top-team` intentionally duplicates "ריאל מדריד" across
 * two slots to demonstrate SCORING-RULES.md §6's duplicate-stacking rule in
 * the UI. Ongoing categories carry partial points already earned; terminal
 * categories (champion/runner-up) sit at 0 until the tournament concludes.
 * Partial totals (8+6+4+0+0=18) match `me`'s `bonusPoints: 18`.
 */
export const bonusPredictions: BonusPrediction[] = [
  {
    categoryId: "bc-top-scorer",
    participantId: currentParticipantId,
    picks: [
      { slotId: "bc-top-scorer-1", pickLabel: "קיליאן אמבפה" },
      { slotId: "bc-top-scorer-2", pickLabel: "ארלינג הולאנד" },
      { slotId: "bc-top-scorer-3", pickLabel: "הארי קיין" },
    ],
    pointsEarned: 8,
  },
  {
    categoryId: "bc-top-assists",
    participantId: currentParticipantId,
    picks: [
      { slotId: "bc-top-assists-1", pickLabel: "ג'וד בלינגהאם" },
      { slotId: "bc-top-assists-2", pickLabel: "פיל פודן" },
      { slotId: "bc-top-assists-3", pickLabel: "עוסמאן דמבלה" },
    ],
    pointsEarned: 6,
  },
  {
    categoryId: "bc-top-team",
    participantId: currentParticipantId,
    picks: [
      { slotId: "bc-top-team-1", pickLabel: "ריאל מדריד" },
      { slotId: "bc-top-team-2", pickLabel: "ריאל מדריד" },
      { slotId: "bc-top-team-3", pickLabel: "באיירן מינכן" },
    ],
    pointsEarned: 4,
  },
  {
    categoryId: "bc-champion",
    participantId: currentParticipantId,
    picks: [{ slotId: "bc-champion-1", pickLabel: "ריאל מדריד" }],
    pointsEarned: null,
  },
  {
    categoryId: "bc-runner-up",
    participantId: currentParticipantId,
    picks: [{ slotId: "bc-runner-up-1", pickLabel: "באיירן מינכן" }],
    pointsEarned: null,
  },
];

export function bonusPredictionForCategory(categoryId: string): BonusPrediction | null {
  return bonusPredictions.find((bp) => bp.categoryId === categoryId) ?? null;
}

/** Current standings per ongoing bonus category — same resolved snapshot everywhere. */
export const bonusLeaders: Record<string, BonusLeaderEntry[]> = {
  "bc-top-scorer": [
    { label: "ארלינג הולאנד", value: 6, rank: 1 },
    { label: "קיליאן אמבפה", value: 5, rank: 2 },
    { label: "הארי קיין", value: 4, rank: 3 },
  ],
  "bc-top-assists": [
    { label: "פיל פודן", value: 5, rank: 1 },
    { label: "ג'וד בלינגהאם", value: 4, rank: 2 },
    { label: "עוסמאן דמבלה", value: 3, rank: 3 },
  ],
  "bc-top-team": [
    { label: "ריאל מדריד", value: 9, rank: 1 },
    { label: "באיירן מינכן", value: 7, rank: 2 },
    { label: "מנצ'סטר סיטי", value: 6, rank: 3 },
  ],
};
