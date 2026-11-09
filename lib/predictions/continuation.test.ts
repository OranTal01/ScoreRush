import { it, expect } from "vitest";
import { nextPrediction, type ContinuationMatch } from "./continuation";
const now = Date.parse("2026-09-14T12:00:00Z");
const game = (
  id: string,
  overrides: Partial<ContinuationMatch> = {},
): ContinuationMatch => ({
  id,
  tournament_id: "cup",
  stage: "league_stage",
  matchday: 2,
  kickoff: "2026-09-15T18:00:00Z",
  lock_time: "2026-09-15T17:55:00Z",
  status: "scheduled",
  tournaments: { onboarding_open: false },
  ...overrides,
});
it("moves forward in a deterministic order and skips saved picks including an explicit 0–0", () => {
  const matches = [game("c"), game("a"), game("b"), game("d")];
  expect(
    nextPrediction(
      game("a"),
      matches,
      [{ match_id: "b", is_default: false }],
      now,
    ),
  ).toEqual({ nextMatchId: "c", remaining: 2 });
  expect(matches.map((m) => m.id)).toEqual(["c", "a", "b", "d"]);
});
it("wraps back to an earlier missing game rather than claiming completion", () => {
  expect(
    nextPrediction(
      game("c"),
      [game("a"), game("b"), game("c")],
      [{ match_id: "b", is_default: false }],
      now,
    ),
  ).toEqual({ nextMatchId: "a", remaining: 1 });
});
it("counts automatic defaults as missing, without returning the just-saved game", () => {
  expect(
    nextPrediction(
      game("a"),
      [game("a"), game("b")],
      [
        { match_id: "a", is_default: true },
        { match_id: "b", is_default: true },
      ],
      now,
    ),
  ).toEqual({ nextMatchId: "b", remaining: 1 });
});
it("excludes locked, cancelled, postponed and unrelated round or tournament games", () => {
  const matches = [
    game("a"),
    game("b", { lock_time: new Date(now).toISOString() }),
    game("c", { status: "cancelled" }),
    game("d", { status: "postponed" }),
    game("e", { matchday: 3 }),
    game("f", { tournament_id: "another" }),
    game("g", { stage: "final" }),
    game("h", { status: "live" }),
  ];
  expect(nextPrediction(game("a"), matches, [], now)).toEqual({
    nextMatchId: null,
    remaining: 0,
  });
});
it("continues retrospective entries only while onboarding permits them", () => {
  const matches = [
    game("a", { matchday: 1 }),
    game("b", {
      matchday: 1,
      status: "finished",
      lock_time: "2000-01-01T00:00:00Z",
      tournaments: { onboarding_open: true, onboarding_matchday: 1 },
    }),
  ];
  expect(nextPrediction(matches[0], matches, [], now).nextMatchId).toBe("b");
  matches[1].tournaments = { onboarding_open: false };
  expect(nextPrediction(matches[0], matches, [], now).nextMatchId).toBeNull();
});
it("handles knockout stages without a round number", () => {
  const current = game("a", { matchday: null, stage: "quarter_final" });
  expect(
    nextPrediction(
      current,
      [
        current,
        game("b", { matchday: null, stage: "quarter_final" }),
        game("c", { matchday: null, stage: "semi_final" }),
      ],
      [],
      now,
    ),
  ).toEqual({ nextMatchId: "b", remaining: 1 });
});
