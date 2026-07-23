/**
 * Contract test against a fixture payload (ARCHITECTURE.md §9) — no network
 * call. `normalizeFootballDataResponse` is exported specifically so this
 * test never has to touch `./client` (which requires FOOTBALL_DATA_API_TOKEN
 * and carries `import "server-only"`).
 */
import { describe, expect, it } from "vitest";
import { normalizeFootballDataResponse } from "./adapter";
import fixture from "../fixtures/football-data-matches.json";

describe("normalizeFootballDataResponse", () => {
  const result = normalizeFootballDataResponse(fixture);

  it("drops the match with an unparseable utcDate and flags it", () => {
    expect(
      result.matches.find((m) => m.providerId === "500005"),
    ).toBeUndefined();
    expect(result.warnings.some((w) => w.refId === "500005")).toBe(true);
  });

  it("normalizes a scheduled match with no scores yet", () => {
    const match = result.matches.find((m) => m.providerId === "500001");
    expect(match).toBeDefined();
    expect(match?.result.status).toBe("scheduled");
    expect(match?.result.regularResult).toBeNull();
    expect(match?.result.winner).toBeNull();
    expect(match?.homeTeam).toEqual({
      providerId: "1",
      name: "Argentina",
      shortName: "Argentina",
    });
  });

  it("maps IN_PLAY to live and surfaces the running score as liveScore, not regularResult", () => {
    const match = result.matches.find((m) => m.providerId === "500002");
    expect(match?.result.status).toBe("live");
    expect(match?.result.liveScore).toEqual({ home: 1, away: 0 });
    expect(match?.result.regularResult).toBeNull();
  });

  it("normalizes a finished regular-time match using fullTime as the 90-minute result", () => {
    const match = result.matches.find((m) => m.providerId === "500003");
    expect(match?.result.status).toBe("finished");
    expect(match?.result.regularResult).toEqual({ home: 2, away: 1 });
    expect(match?.result.extraTimeResult).toBeNull();
    expect(match?.result.penaltyResult).toBeNull();
    expect(match?.result.winner).toBe("home");
  });

  it("splits a penalty-shootout match into regular/extra-time/penalty fields, never conflating them", () => {
    const match = result.matches.find((m) => m.providerId === "500004");
    expect(match?.result.regularResult).toEqual({ home: 1, away: 1 });
    expect(match?.result.extraTimeResult).toEqual({ home: 1, away: 1 });
    expect(match?.result.penaltyResult).toEqual({ home: 4, away: 5 });
    // Away team won on penalties despite a drawn regular + extra-time score.
    expect(match?.result.winner).toBe("away");
  });

  it("flags (but does not drop) a FINISHED match with no reported score", () => {
    const match = result.matches.find((m) => m.providerId === "500006");
    expect(match).toBeDefined();
    expect(match?.result.regularResult).toBeNull();
    expect(result.warnings.some((w) => w.refId === "500006")).toBe(true);
  });

  it("lowercases stage/group mechanically without semantic remapping", () => {
    const match = result.matches.find((m) => m.providerId === "500004");
    expect(match?.stage).toBe("round_of_16");
    const grouped = result.matches.find((m) => m.providerId === "500001");
    expect(grouped?.group).toBe("group_a");
  });

  it("stores the raw provider payload alongside the canonical result", () => {
    const match = result.matches.find((m) => m.providerId === "500003");
    expect(match?.rawProviderPayload).toMatchObject({ id: 500003 });
  });

  it("handles a missing matches array without throwing", () => {
    const result = normalizeFootballDataResponse({});
    expect(result.matches).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });
});
