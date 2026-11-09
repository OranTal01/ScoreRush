import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScorePair } from "./score-pair";
import { MatchCard } from "./match-card";
import type { MatchWithTeams } from "@/lib/matches/list";

describe("home and away score presentation", () => {
  it.each([
    { home: 2, away: 0 },
    { home: 0, away: 3 },
    { home: 10, away: 2 },
    { home: 1, away: 1 },
  ])(
    "keeps $home home goals and $away away goals on their RTL sides",
    ({ home, away }) => {
      render(
        <ScorePair
          home={home}
          away={away}
          homeLabel="ריאל"
          awayLabel="אינטר"
        />,
      );
      const score = screen.getByRole("img", {
        name: `ריאל: ${home}, אינטר: ${away}`,
      });
      // A whole LTR number pair put home goals next to the away team. Use
      // separate numbers in an explicitly RTL flex row, regardless of nesting.
      expect(score).toHaveAttribute("dir", "rtl");
      const numbers = score.querySelectorAll("bdi");
      expect(Array.from(numbers, (node) => node.textContent)).toEqual([
        String(home),
        String(away),
      ]);
      for (const number of numbers)
        expect(number).toHaveAttribute("dir", "ltr");
    },
  );

  it("associates both the actual result and a different prediction with the correct teams", () => {
    const match: MatchWithTeams = {
      id: "match",
      tournamentId: "tournament",
      stage: "league_stage",
      group: "league",
      matchday: 1,
      kickoff: "2026-09-08T19:00:00Z",
      lockTime: "2026-09-08T18:55:00Z",
      status: "finished",
      regularResult: { home: 2, away: 0 },
      liveScore: null,
      homeTeam: {
        id: "home",
        name: "ריאל",
        shortName: "ריאל",
        flagAssetUrl: null,
      },
      awayTeam: {
        id: "away",
        name: "אינטר",
        shortName: "אינטר",
        flagAssetUrl: null,
      },
      ownPrediction: {
        predictedHome: 0,
        predictedAway: 3,
        pointsEarned: 0,
        outcome: "wrong",
      },
    };
    render(
      <div dir="rtl">
        <MatchCard match={match} />
      </div>,
    );
    expect(
      screen.getByRole("img", { name: "ריאל: 2, אינטר: 0" }),
    ).toHaveAttribute("dir", "rtl");
    expect(
      screen.getByRole("img", { name: "ריאל: 0, אינטר: 3" }),
    ).toHaveAttribute("dir", "rtl");
    expect(
      screen.getByRole("link", { name: "פרטי המשחק והניחוש" }),
    ).toHaveAttribute("href", "/predictions/match");
  });
});
