import { describe, expect, it } from "vitest";
import {
  israelDateInput,
  israelInputToIso,
  settingsSchema,
} from "./settings-input";

export const exampleSettings = {
  tournamentId: "11111111-1111-4111-8111-111111111111",
  revision: 0,
  name: "טורניר חברים",
  matchLockMinutes: 5,
  exactScorePoints: 9,
  winnerAndDiffPoints: 6,
  winnerOnlyPoints: 3,
  wrongPoints: 0,
  groupRankingPointsPerPosition: 3,
  rankingConfig: { mode: "exact" as const },
  rankingLocksAt: null,
  onboardingOpen: false,
  onboardingMatchday: 1,
  prizes: [],
  categories: [],
};
describe("tournament settings validation", () => {
  it("accepts valid settings and rejects negative or fractional points", () => {
    expect(settingsSchema.safeParse(exampleSettings).success).toBe(true);
    for (const exactScorePoints of [-1, 1.5, 1000, NaN])
      expect(
        settingsSchema.safeParse({ ...exampleSettings, exactScorePoints })
          .success,
      ).toBe(false);
  });
  it("rejects duplicated or mismatched bonus identifiers", () => {
    const category = {
      id: "22222222-2222-4222-8222-222222222222",
      name: "מלך שערים",
      type: "team",
      statKey: "top_scorer",
      resolvesAt: "ongoing",
      duplicateStackingAllowed: true,
      locksAt: null,
      slots: [{ points: 20 }],
    };
    expect(
      settingsSchema.safeParse({ ...exampleSettings, categories: [category] })
        .success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...exampleSettings,
        categories: [
          { ...category, type: "player" },
          { ...category, type: "player" },
        ],
      }).success,
    ).toBe(false);
  });
  it("uses Israel summer/winter time regardless of the browser timezone", () => {
    expect(israelInputToIso("2026-09-09T21:00")).toBe(
      "2026-09-09T18:00:00.000Z",
    );
    expect(israelInputToIso("2026-12-09T21:00")).toBe(
      "2026-12-09T19:00:00.000Z",
    );
    expect(israelDateInput("2026-09-09T18:00:00.000Z")).toBe(
      "2026-09-09T21:00",
    );
    expect(israelInputToIso("")).toBeNull();
  });
  it("rejects nonexistent daylight-saving wall times", () => {
    expect(() => israelInputToIso("2026-03-27T02:30")).toThrow();
  });
});
