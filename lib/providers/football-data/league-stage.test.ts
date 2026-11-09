import { describe, expect, it } from "vitest";
import { normalizeFootballDataMatch } from "./normalize";
import type { FDMatch } from "./schema";
const raw: FDMatch = { id: 123, utcDate: "2026-09-08T16:45:00Z", status: "TIMED", stage: "LEAGUE_STAGE", group: null, matchday: 1, homeTeam: { id: 1, name: "Home" }, awayTeam: { id: 2, name: "Away" }, score: { winner: null, duration: "REGULAR", fullTime: { home:null, away:null }, halfTime: { home:null, away:null } } };
describe("Champions League phases", () => {
 it("collects league-phase matches in the shared ranking", () => { expect(normalizeFootballDataMatch(raw, raw).match.group).toBe("league"); });
 it("does not include knockout matches in the league ranking", () => { expect(normalizeFootballDataMatch({...raw,stage:"LAST_16"},raw).match.group).toBeNull(); });
});
