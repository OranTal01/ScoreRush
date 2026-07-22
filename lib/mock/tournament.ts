import type { Prize, Tournament } from "./types";

export const tournament: Tournament = {
  id: "cl-2027",
  name: "מועדון בית — ליגת האלופות 2027",
  competition: "ליגת האלופות",
  status: "active",
};

/** A second, unrelated tournament — purely to give the switcher something to switch to. */
export const otherTournaments: Tournament[] = [
  { id: "euro-2028", name: "יורו 2028 — קבוצת החברים", competition: "יורו", status: "upcoming" },
];

export const prizes: Prize[] = [
  { rank: 1, description: "ערב פיצה על חשבון הקבוצה 🍕" },
  { rank: 2, description: "כניסה חינם למשחק הבא" },
  { rank: 3, description: "כבוד ותהילה (ותפריט ראשון בברירה)" },
];
