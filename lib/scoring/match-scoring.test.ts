/**
 * Scenarios mirror the legacy project's validated test suite
 * (world-cup-bets/lib/scoring.test.ts `describe('scoreMatchPrediction')`),
 * ported to the default `scoring_rules` point values (SCORING-RULES.md §2)
 * plus ScoreRush's added outcome-label classification and the
 * ET/penalty-exclusion guarantee that `scoreMatch` adds on top.
 */
import { describe, expect, it } from "vitest";
import {
  type MatchScoringRules,
  scoreMatch,
  scoreMatchPrediction,
} from "./match-scoring";

const rules: MatchScoringRules = {
  exactScorePoints: 9,
  winnerAndDiffPoints: 6,
  winnerOnlyPoints: 3,
  wrongPoints: 0,
};

describe("scoreMatchPrediction", () => {
  it("awards 9 and 'exact' for an exact score", () => {
    expect(
      scoreMatchPrediction({ home: 2, away: 1 }, { home: 2, away: 1 }, rules),
    ).toEqual({ outcome: "exact", points: 9 });
  });

  it("awards 6 and 'winner_diff' for correct winner + correct goal difference", () => {
    expect(
      scoreMatchPrediction({ home: 2, away: 0 }, { home: 3, away: 1 }, rules),
    ).toEqual({ outcome: "winner_diff", points: 6 });
  });

  it("awards 3 and 'winner' for correct winner only", () => {
    expect(
      scoreMatchPrediction({ home: 2, away: 0 }, { home: 1, away: 0 }, rules),
    ).toEqual({ outcome: "winner", points: 3 });
  });

  it("awards 0 and 'wrong' for a wrong winner", () => {
    expect(
      scoreMatchPrediction({ home: 2, away: 0 }, { home: 0, away: 2 }, rules),
    ).toEqual({ outcome: "wrong", points: 0 });
  });

  it("awards 9 and 'exact' for an exact draw", () => {
    expect(
      scoreMatchPrediction({ home: 1, away: 1 }, { home: 1, away: 1 }, rules),
    ).toEqual({ outcome: "exact", points: 9 });
  });

  it("awards 6 and 'draw_correct' (never 'winner_diff') for a correctly predicted draw with a different scoreline — draw goal difference is always 0", () => {
    expect(
      scoreMatchPrediction({ home: 1, away: 1 }, { home: 0, away: 0 }, rules),
    ).toEqual({ outcome: "draw_correct", points: 6 });
    expect(
      scoreMatchPrediction({ home: 1, away: 1 }, { home: 2, away: 2 }, rules),
    ).toEqual({ outcome: "draw_correct", points: 6 });
  });

  it("awards 0 when a draw is predicted as a win", () => {
    expect(
      scoreMatchPrediction({ home: 1, away: 1 }, { home: 1, away: 0 }, rules),
    ).toEqual({ outcome: "wrong", points: 0 });
  });

  it("awards 0 when a 0-0 draw is predicted as an away win", () => {
    expect(
      scoreMatchPrediction({ home: 0, away: 0 }, { home: 0, away: 1 }, rules),
    ).toEqual({ outcome: "wrong", points: 0 });
  });

  it("awards 3 for a correct away win with the wrong goal difference", () => {
    expect(
      scoreMatchPrediction({ home: 0, away: 2 }, { home: 0, away: 1 }, rules),
    ).toEqual({ outcome: "winner", points: 3 });
  });

  it("awards 6 for a correct away win with a matching goal difference", () => {
    expect(
      scoreMatchPrediction({ home: 0, away: 2 }, { home: 1, away: 3 }, rules),
    ).toEqual({ outcome: "winner_diff", points: 6 });
  });

  it("honors non-default configured point values", () => {
    const custom: MatchScoringRules = {
      exactScorePoints: 100,
      winnerAndDiffPoints: 50,
      winnerOnlyPoints: 25,
      wrongPoints: -5,
    };
    expect(
      scoreMatchPrediction({ home: 2, away: 1 }, { home: 2, away: 1 }, custom),
    ).toEqual({ outcome: "exact", points: 100 });
    expect(
      scoreMatchPrediction({ home: 2, away: 0 }, { home: 0, away: 2 }, custom),
    ).toEqual({ outcome: "wrong", points: -5 });
  });
});

describe("scoreMatch (ET/penalty exclusion)", () => {
  it("returns null for a match that hasn't finished, even with a live score present", () => {
    expect(
      scoreMatch(
        { status: "live", regularResult: null },
        { home: 1, away: 0 },
        rules,
      ),
    ).toBeNull();
  });

  it("returns null for a finished-but-flagged match with no regularResult", () => {
    expect(
      scoreMatch(
        { status: "finished", regularResult: null },
        { home: 1, away: 0 },
        rules,
      ),
    ).toBeNull();
  });

  it("scores only off the 90-minute regularResult for a knockout match that went to extra time/penalties — a caller can't reach the ET/penalty scores at all, since ScorableMatch doesn't carry them", () => {
    // A knockout match that finished 1-1 after 90 minutes, then was won in
    // extra time/penalties — regularResult (the only field this function can
    // see) still correctly reflects the 90-minute score.
    const knockoutMatch = { status: "finished" as const, regularResult: { home: 1, away: 1 } };
    expect(scoreMatch(knockoutMatch, { home: 1, away: 1 }, rules)).toEqual({
      outcome: "exact",
      points: 9,
    });
    // A prediction of the eventual (extra-time/penalty) winner, not the
    // 90-minute draw, scores as wrong — proving ET/penalties never leak in.
    expect(scoreMatch(knockoutMatch, { home: 2, away: 1 }, rules)).toEqual({
      outcome: "wrong",
      points: 0,
    });
  });
});
