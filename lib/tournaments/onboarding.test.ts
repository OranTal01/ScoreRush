import { describe, expect, it } from "vitest";
import { allowsRetrospectiveEntry } from "./onboarding";
describe("opening-round onboarding", () => {
  const settings = { onboarding_open: true, onboarding_matchday: 1 };
  it("allows opening-round predictions even after a match finishes", () => {
    expect(
      allowsRetrospectiveEntry(settings, {
        matchday: 1,
        stage: "league_stage",
        status: "finished",
      }),
    ).toBe(true);
  });
  it("never opens later rounds or knockouts", () => {
    expect(
      allowsRetrospectiveEntry(settings, {
        matchday: 2,
        stage: "league_stage",
      }),
    ).toBe(false);
    expect(
      allowsRetrospectiveEntry(settings, { matchday: 1, stage: "final" }),
    ).toBe(false);
  });
  it("closes retrospectivity after onboarding, and fails closed for missing settings", () => {
    expect(
      allowsRetrospectiveEntry(
        { ...settings, onboarding_open: false },
        { matchday: 1, stage: "league_stage" },
      ),
    ).toBe(false);
    expect(
      allowsRetrospectiveEntry(null, { matchday: 1, stage: "group" }),
    ).toBe(false);
    expect(
      allowsRetrospectiveEntry(settings, {
        matchday: 1,
        stage: "league_stage",
        status: "cancelled",
      }),
    ).toBe(false);
  });

  it("stops retrospective entry at the configured automatic deadline", () => {
    const scheduled = {
      ...settings,
      onboarding_matchday: 2,
      onboarding_closes_at: "2026-10-19T21:00:00.000Z",
    };
    expect(
      allowsRetrospectiveEntry(
        scheduled,
        { matchday: 2, stage: "league_stage" },
        Date.parse("2026-10-19T20:59:59.999Z"),
      ),
    ).toBe(true);
    expect(
      allowsRetrospectiveEntry(
        scheduled,
        { matchday: 2, stage: "league_stage" },
        Date.parse("2026-10-19T21:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
