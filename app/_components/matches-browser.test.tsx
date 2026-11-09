import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchWithTeams } from "@/lib/matches/list";
import { MatchesBrowser, needsPrediction } from "./matches-browser";

const match: MatchWithTeams = {
  id: "opening",
  tournamentId: "tournament",
  stage: "league_stage",
  group: "league",
  matchday: 1,
  kickoff: "2026-09-08T19:00:00Z",
  lockTime: "2026-09-08T18:55:00Z",
  status: "finished",
  regularResult: { home: 2, away: 1 },
  liveScore: null,
  retrospectiveEntry: true,
  homeTeam: {
    id: "home",
    name: "Arsenal FC",
    shortName: "Arsenal",
    flagAssetUrl: null,
  },
  awayTeam: {
    id: "away",
    name: "Paris Saint-Germain",
    shortName: "PSG",
    flagAssetUrl: null,
  },
  ownPrediction: null,
};

describe("match browsing", () => {
  beforeEach(() => localStorage.clear());
  it("restores device drafts after confirmed navigation", () => {
    render(<MatchesBrowser draftScope="test-cup:self" matches={[match]} />);
    fireEvent.click(screen.getByRole("button", { name: "מילוי מהיר ⚡" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "שערים של Arsenal" }),
      { target: { value: "2" } },
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "טרם ניחשתי" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("textbox", { name: "שערים של Arsenal" }),
    ).toHaveValue("2");
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "טרם ניחשתי" }));
    expect(
      screen.getByRole("textbox", { name: "שערים של Arsenal" }),
    ).toHaveValue("2");
    fireEvent.change(
      screen.getByRole("textbox", { name: "שערים של Arsenal" }),
      { target: { value: "1" } },
    );
    confirm.mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "הכול" }));
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(
      screen.getByRole("textbox", { name: "שערים של Arsenal" }),
    ).toHaveValue("1");
    confirm.mockRestore();
  });
  it("keeps automatic defaults in the missing-picks filter but excludes submitted zero draws", () => {
    const prediction = {
      predictedHome: 0,
      predictedAway: 0,
      pointsEarned: null,
      outcome: null,
    };
    expect(
      needsPrediction({
        ...match,
        ownPrediction: { ...prediction, isDefault: true },
      }),
    ).toBe(true);
    expect(needsPrediction({ ...match, ownPrediction: prediction })).toBe(
      false,
    );
    expect(needsPrediction({ ...match, retrospectiveEntry: false })).toBe(
      false,
    );
  });
  it("filters by round and searches both team names without dropping the selected round", () => {
    render(
      <MatchesBrowser
        draftScope="test-cup:self"
        matches={[
          match,
          { ...match, id: "later", matchday: 2, retrospectiveEntry: false },
        ]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 משחקים · מחזור 1");
    fireEvent.change(screen.getByRole("combobox", { name: "מחזור" }), {
      target: { value: "all" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("2 משחקים");
    fireEvent.change(screen.getByRole("searchbox", { name: "חיפוש קבוצה" }), {
      target: { value: "paris" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("2 משחקים");
    fireEvent.change(screen.getByRole("searchbox", { name: "חיפוש קבוצה" }), {
      target: { value: "missing-team" },
    });
    expect(screen.getByText(/לא נמצאו משחקים/)).toBeVisible();
  });
  it("preserves final match status during retrospective entry", () => {
    render(<MatchesBrowser draftScope="test-cup:self" matches={[match]} />);
    expect(screen.getByText("הסתיים")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /השלמת ניחוש חסר/ }),
    ).toHaveAttribute("href", "/predictions/opening");
  });
});
