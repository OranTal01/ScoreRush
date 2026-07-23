/**
 * Scenarios mirror world-cup-bets/lib/scoring.test.ts and bonus-scoring.test.ts
 * (scoreTopScorer/scoreTopAssists/scoreTopScoringTeam duplicate-accumulation
 * cases), generalized to admin-configured slot points instead of the legacy
 * project's hardcoded [20, 10, 10], plus SCORING-RULES.md §6's "ties for
 * first all count as winners" rule and §7's terminal-category exclusion.
 */
import { describe, expect, it } from "vitest";
import {
  type BonusPick,
  type BonusStatWinner,
  isBonusCategoryScorable,
  scoreBonusCategory,
} from "./bonus-scoring";

function pick(overrides: Partial<BonusPick>): BonusPick {
  return { slotId: "slot", points: 0, pickRefId: null, pickLabel: "", ...overrides };
}

describe("scoreBonusCategory", () => {
  const stats: BonusStatWinner[] = [
    { refId: "p1", label: "Mbappe", rank: 1 },
    { refId: "p2", label: "Haaland", rank: 2 },
    { refId: "p3", label: "Kane", rank: 2 },
  ];

  it("awards the slot's points when choice 1 is the winner", () => {
    const picks = [
      pick({ slotId: "1", points: 20, pickRefId: "p1", pickLabel: "Mbappe" }),
      pick({ slotId: "2", points: 10, pickRefId: "p2", pickLabel: "Haaland" }),
      pick({ slotId: "3", points: 10, pickRefId: "px", pickLabel: "Kane" }),
    ];
    expect(scoreBonusCategory(picks, stats)).toBe(20);
  });

  it("awards 0 when no pick matches the winner", () => {
    const picks = [
      pick({ slotId: "1", points: 20, pickRefId: "p9", pickLabel: "Vinicius" }),
    ];
    expect(scoreBonusCategory(picks, stats)).toBe(0);
  });

  it("accumulates points when duplicate picks all match the winner (stacking, SCORING-RULES.md §6)", () => {
    const picks = [
      pick({ slotId: "1", points: 20, pickRefId: "p1", pickLabel: "Mbappe" }),
      pick({ slotId: "2", points: 10, pickRefId: "p1", pickLabel: "Mbappe" }),
      pick({ slotId: "3", points: 10, pickRefId: "p1", pickLabel: "Mbappe" }),
    ];
    expect(scoreBonusCategory(picks, stats)).toBe(40);
  });

  it("counts every entry tied for rank 1 as a winner", () => {
    const tiedStats: BonusStatWinner[] = [
      { refId: "p1", label: "Mbappe", rank: 1 },
      { refId: "p2", label: "Messi", rank: 1 },
      { refId: "p3", label: "Haaland", rank: 3 },
    ];
    const picks = [
      pick({ slotId: "1", points: 20, pickRefId: "p2", pickLabel: "Messi" }),
      pick({ slotId: "2", points: 10, pickRefId: "p3", pickLabel: "Haaland" }),
    ];
    expect(scoreBonusCategory(picks, tiedStats)).toBe(20);
  });

  it("matches by refId when both sides have one, ignoring label drift", () => {
    const picks = [
      pick({ slotId: "1", points: 20, pickRefId: "p1", pickLabel: "Stale Name" }),
    ];
    expect(scoreBonusCategory(picks, stats)).toBe(20);
  });

  it("falls back to a label match when either side has no refId (manual entries)", () => {
    const manualStats: BonusStatWinner[] = [
      { refId: null, label: "Argentina", rank: 1 },
    ];
    const picks = [
      pick({ slotId: "1", points: 20, pickRefId: null, pickLabel: "Argentina" }),
    ];
    expect(scoreBonusCategory(picks, manualStats)).toBe(20);
  });
});

describe("isBonusCategoryScorable", () => {
  it("an 'ongoing' category is always scorable", () => {
    expect(
      isBonusCategoryScorable({ resolvesAt: "ongoing" }, "upcoming"),
    ).toBe(true);
    expect(isBonusCategoryScorable({ resolvesAt: "ongoing" }, "active")).toBe(
      true,
    );
  });

  it("a 'tournament_end' terminal category is excluded until the tournament has finished (SCORING-RULES.md §7)", () => {
    expect(
      isBonusCategoryScorable({ resolvesAt: "tournament_end" }, "upcoming"),
    ).toBe(false);
    expect(
      isBonusCategoryScorable({ resolvesAt: "tournament_end" }, "active"),
    ).toBe(false);
    expect(
      isBonusCategoryScorable({ resolvesAt: "tournament_end" }, "finished"),
    ).toBe(true);
  });
});
