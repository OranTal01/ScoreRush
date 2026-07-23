import { describe, expect, it } from "vitest";
import { normalizeManualEntries } from "./adapter";
import fixture from "../fixtures/manual-entries.json";

describe("normalizeManualEntries", () => {
  const result = normalizeManualEntries(fixture);

  it("normalizes a finished match that went to penalties, keeping all three results distinct", () => {
    const match = result.matches.find(
      (m) => m.homeTeam.name === "Local United",
    );
    expect(match).toBeDefined();
    expect(match?.providerId).toBeNull();
    expect(match?.result.regularResult).toEqual({ home: 3, away: 3 });
    expect(match?.result.extraTimeResult).toEqual({ home: 4, away: 4 });
    expect(match?.result.penaltyResult).toEqual({ home: 5, away: 4 });
    // No explicit winner supplied — derived from the penalty score.
    expect(match?.result.winner).toBe("home");
  });

  it("normalizes a scheduled match with no scores", () => {
    const match = result.matches.find((m) => m.homeTeam.name === "Riverside");
    expect(match?.result.status).toBe("scheduled");
    expect(match?.result.regularResult).toBeNull();
    expect(match?.result.winner).toBeNull();
  });

  it("rejects (drops + warns on) a negative score at the shape-validation stage", () => {
    expect(
      result.matches.find((m) => m.homeTeam.name === "Bad Score FC"),
    ).toBeUndefined();
    expect(
      result.warnings.some((w) => w.message.includes("shape validation")),
    ).toBe(true);
  });

  it("rejects an entry with an empty team name", () => {
    expect(
      result.matches.find((m) => m.awayTeam.name === "Valid Team"),
    ).toBeUndefined();
  });

  it("flags (but keeps) an entry where home and away teams share a name", () => {
    const match = result.matches.find(
      (m) => m.homeTeam.name === "Typo Town" && m.awayTeam.name === "Typo Town",
    );
    expect(match).toBeDefined();
    expect(result.warnings.some((w) => w.message.includes("same name"))).toBe(
      true,
    );
  });

  it("stores the admin's own submission as the raw payload", () => {
    const match = result.matches.find((m) => m.homeTeam.name === "Riverside");
    expect(match?.rawProviderPayload).toMatchObject({
      stage: "group",
      group: "A",
    });
  });
});
