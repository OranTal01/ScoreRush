import type { Team } from "./types";

/**
 * Mock Champions League-style tournament — matches the launch-tournament
 * intent noted in ROADMAP.md/DECISIONS.md. Team list, groups, and results
 * below are entirely fictional prototype data, not real fixtures.
 */
export const teams: Team[] = [
  {
    id: "rm",
    name: "ריאל מדריד",
    shortName: "ריאל",
    flagEmoji: "🇪🇸",
    group: "A",
    seed: 1,
  },
  {
    id: "mc",
    name: "מנצ'סטר סיטי",
    shortName: "סיטי",
    flagEmoji: "🇬🇧",
    group: "A",
    seed: 4,
  },
  {
    id: "bvb",
    name: "בורוסיה דורטמונד",
    shortName: "דורטמונד",
    flagEmoji: "🇩🇪",
    group: "A",
    seed: 5,
  },
  {
    id: "int",
    name: "אינטר מילאנו",
    shortName: "אינטר",
    flagEmoji: "🇮🇹",
    group: "A",
    seed: 8,
  },
  {
    id: "bay",
    name: "באיירן מינכן",
    shortName: "באיירן",
    flagEmoji: "🇩🇪",
    group: "B",
    seed: 2,
  },
  {
    id: "psg",
    name: "פריז סן ז'רמן",
    shortName: "פריז",
    flagEmoji: "🇫🇷",
    group: "B",
    seed: 3,
  },
  {
    id: "liv",
    name: "ליברפול",
    shortName: "ליברפול",
    flagEmoji: "🇬🇧",
    group: "B",
    seed: 6,
  },
  {
    id: "ars",
    name: "ארסנל",
    shortName: "ארסנל",
    flagEmoji: "🇬🇧",
    group: "B",
    seed: 7,
  },
];

export function teamById(id: string): Team {
  const team = teams.find((t) => t.id === id);
  if (!team) throw new Error(`Unknown mock team id: ${id}`);
  return team;
}
