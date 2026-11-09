import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Podium } from "./podium";
import type { LeaderboardParticipant } from "./types";
const member = (id: string, rank: number): LeaderboardParticipant => ({
  id,
  displayName: id,
  avatarInitials: id,
  rank,
  previousRank: rank,
  totalPoints: 60,
  matchPoints: 60,
  bonusPoints: 0,
  groupRankingPoints: 0,
});
describe("podium ties", () => {
  it("includes every participant when four people share a podium rank", () => {
    render(
      <Podium
        topThree={[
          member("Leader", 1),
          member("B", 2),
          member("C", 2),
          member("D", 2),
          member("E", 2),
        ]}
        selfId="D"
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(
      screen.getByText("מקום 2 משותף", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText("E")).toBeInTheDocument();
  });
  it("keeps both participants sharing first place", () => {
    render(
      <Podium
        topThree={[member("Oran", 1), member("Liron", 1)]}
        selfId="Oran"
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByText("Liron").length).toBeGreaterThan(0);
  });
  it("keeps all three participants when second place is shared", () => {
    render(
      <Podium
        topThree={[member("A", 1), member("B", 2), member("C", 2)]}
        selfId="A"
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
