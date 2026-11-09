import { describe, expect, it } from "vitest";
import dictionary from "./football-names.he.json";
import {
  footballName,
  footballSearchText,
  footballChoiceLabel,
  resolveFootballChoice,
} from "./football-names";
describe("Hebrew football names", () => {
  it("covers every current team, roster player and legacy statistic name without changing identifiers", () => {
    expect(dictionary.teams).toHaveLength(36);
    expect(dictionary.players).toHaveLength(899);
    for (const entries of [dictionary.teams, dictionary.players]) {
      expect(new Set(entries.map((e) => e.providerId)).size).toBe(
        entries.length,
      );
      for (const e of entries) {
        expect(e.he).toMatch(/[א-ת]/);
        expect(e.he).not.toMatch(/[a-z]/i);
        expect(footballName(e.en)).toBe(e.he);
      }
    }
    for (const [en, he] of Object.entries(dictionary.otherNames))
      expect(footballName(en)).toBe(he);
  });
  it("accepts full, short and accented spellings and keeps names outside the dictionary", () => {
    for (const team of dictionary.teams)
      for (const alias of team.aliases)
        expect(footballName(alias)).toBe(team.he);
    expect(footballName("Kylian Mbappe")).toBe("קיליאן אמבפה");
    expect(footballName("אורן טל")).toBe("אורן טל");
    expect(footballName("Taganya")).toBe("Taganya");
    expect(footballName("New Unknown Club")).toBe("New Unknown Club");
    expect(footballSearchText("פריז סן־ז׳רמן")).toContain("psg");
    expect(footballSearchText("ברצלונה")).toContain("barca");
  });
  it("round-trips Hebrew and English selection to the same canonical bonus ID and label", () => {
    const option = {
      refId: "player-1",
      label: "Michael Olise",
      team: "FC Bayern München",
    };
    const copy = structuredClone(option);
    expect(footballChoiceLabel(option)).toBe("מייקל אוליסה · באיירן מינכן");
    for (const value of [
      footballChoiceLabel(option),
      footballChoiceLabel(option, "en"),
      "מייקל אוליסה",
      "Michael Olise",
    ])
      expect(resolveFootballChoice([option], value)).toEqual(copy);
    expect(option).toEqual(copy);
  });
  it("does not conflate two players with the same name", () => {
    const options = [
      { refId: "1", label: "Pedrinho", team: "FC Porto" },
      { refId: "2", label: "Pedrinho", team: "FK Shakhtar Donetsk" },
    ];
    expect(resolveFootballChoice(options, "פדריניו")).toBeUndefined();
    expect(
      resolveFootballChoice(options, "פדריניו · שחטאר דונייצק")?.refId,
    ).toBe("2");
  });
});
