import { describe, it, expect } from "vitest";
import { detectLiveChanges, liveFresh } from "./changes";
import { projectStandings } from "./projection";
import { predictionImpact, describeLiveChange } from "./messages";
import { fdMatchSchema } from "@/lib/providers/football-data/schema";
import { normalizeFootballDataMatch } from "@/lib/providers/football-data/normalize";
import type { LiveObservation } from "./types";
const time = "2026-09-13T19:00:00Z",
  next = "2026-09-13T19:01:00Z";
const before: LiveObservation = {
  status: "live",
  score: { home: 0, away: 0 },
  details: {
    regulationScore: { home: 0, away: 0 },
    period: "REGULAR",
    minute: 1,
    cards: [],
    sourceUpdatedAt: time,
  },
  observedAt: time,
};
const after: LiveObservation = {
  ...before,
  score: { home: 1, away: 0 },
  details: {
    ...before.details!,
    regulationScore: { home: 1, away: 0 },
    minute: 2,
    sourceUpdatedAt: next,
  },
  observedAt: next,
};
const rules = {
  exactScorePoints: 9,
  winnerAndDiffPoints: 6,
  winnerOnlyPoints: 3,
  wrongPoints: 0,
};
describe("significant live changes", () => {
  it("seeds silently, ignores duplicates, gaps and older provider snapshots", () => {
    expect(detectLiveChanges(null, after)).toEqual([]);
    expect(detectLiveChanges(before, before)).toEqual([]);
    expect(
      detectLiveChanges(before, {
        ...after,
        observedAt: "2026-09-13T19:04:00Z",
      }),
    ).toEqual([]);
    expect(
      detectLiveChanges(before, {
        ...after,
        details: { ...after.details!, sourceUpdatedAt: "2026-09-13T18:59:00Z" },
      }),
    ).toEqual([]);
  });
  it("distinguishes one goal from a correction or a batch of missed goals", () => {
    expect(detectLiveChanges(before, after)[0]).toMatchObject({
      kind: "goal",
      side: "home",
    });
    expect(
      detectLiveChanges(before, { ...after, score: { home: 0, away: 1 } })[0],
    ).toMatchObject({ kind: "goal", side: "away" });
    expect(
      detectLiveChanges(after, {
        ...before,
        observedAt: "2026-09-13T19:02:00Z",
        details: { ...before.details!, sourceUpdatedAt: null },
      })[0].kind,
    ).toBe("score_change");
    expect(
      detectLiveChanges(before, { ...after, score: { home: 2, away: 0 } })[0]
        .kind,
    ).toBe("score_change");
  });
  it("does not announce shootout kicks or duplicate a final score as a fresh goal", () => {
    expect(
      detectLiveChanges(before, { ...after, status: "finished" }).map(
        (e) => e.kind,
      ),
    ).toEqual(["finished"]);
    expect(
      detectLiveChanges(before, {
        ...after,
        details: { ...after.details!, period: "PENALTY_SHOOTOUT" },
      }),
    ).toEqual([]);
    expect(
      detectLiveChanges(
        { ...before, status: "scheduled", score: null },
        after,
      ).map((e) => e.kind),
    ).toEqual(["kickoff"]);
  });
  it("handles red cards, removals and unavailable card coverage", () => {
    const card = {
      key: "a",
      teamId: "h",
      player: "Player",
      type: "YELLOW_RED" as const,
      minute: 22,
    };
    const withCard = {
      ...after,
      score: before.score,
      details: { ...after.details!, cards: [card] },
    };
    expect(detectLiveChanges(before, withCard).map((e) => e.kind)).toEqual([
      "red_card",
    ]);
    expect(
      detectLiveChanges(withCard, {
        ...withCard,
        observedAt: "2026-09-13T19:02:00Z",
        details: { ...withCard.details, cards: [] },
      })[0].kind,
    ).toBe("card_correction");
    expect(
      detectLiveChanges(withCard, {
        ...withCard,
        observedAt: "2026-09-13T19:02:00Z",
        details: { ...withCard.details, cards: null },
      }),
    ).toEqual([]);
  });
  it("personalizes only an actual submitted pick and explains provisional points", () => {
    const event = detectLiveChanges(before, after)[0];
    expect(
      predictionImpact(event, { home: 1, away: 0, isDefault: false }, rules),
    ).toContain("מדויק");
    expect(
      predictionImpact(event, { home: 1, away: 0, isDefault: false }, rules),
    ).toContain("+9");
    expect(
      predictionImpact(event, { home: 0, away: 0, isDefault: true }, rules),
    ).toBe("");
    expect(
      describeLiveChange({ ...event, kind: "score_change" }, "A", "B", "h"),
    ).not.toContain("VAR");
  });
  it("expires stale data according to the actual delivery cadence", () => {
    expect(liveFresh(time, Date.parse(time) + 181000, "events")).toBe(false);
    expect(liveFresh(time, Date.parse(time) + 181000, "delayed")).toBe(true);
    expect(liveFresh(null, Date.parse(time), "scores")).toBe(false);
  });
});
describe("provisional standings", () => {
  const members = [
    {
      participantId: "a",
      name: "A",
      matchPoints: 9,
      groupRankingPoints: 3,
      bonusPoints: 20,
    },
    {
      participantId: "b",
      name: "B",
      matchPoints: 26,
      groupRankingPoints: 0,
      bonusPoints: 0,
    },
  ];
  const match = {
    id: "m",
    status: "live",
    regulationScore: { home: 1, away: 0 },
    locked: true,
    fresh: true,
    normalized: true,
  };
  it("uses the real scoring rules, keeps bonuses, ties and persisted inputs intact", () => {
    const picks = [
      { matchId: "m", participantId: "a", home: 2, away: 0, points: null },
      { matchId: "m", participantId: "b", home: 1, away: 0, points: null },
    ];
    const original = JSON.stringify({ members, picks });
    const result = projectStandings(members, [match], picks, rules);
    expect(
      result.standings.map((p) => [p.projectedRank, p.projectedPoints]),
    ).toEqual([
      [1, 35],
      [1, 35],
    ]);
    expect(result.standings.find((p) => p.id === "b")?.officialRank).toBe(2);
    expect(JSON.stringify({ members, picks })).toBe(original);
  });
  it("does not double-count already-stored points or ignore the 0–0 default", () => {
    const result = projectStandings(
      members,
      [{ ...match, regulationScore: { home: 0, away: 0 } }],
      [{ matchId: "m", participantId: "a", home: 0, away: 0, points: 9 }],
      rules,
    );
    expect(result.standings.find((p) => p.id === "a")?.temporaryPoints).toBe(0);
    expect(result.standings.find((p) => p.id === "b")?.temporaryPoints).toBe(9);
  });
  it("excludes open, retrospective, finished, missing and stale results", () => {
    for (const invalid of [
      { locked: false },
      { fresh: false },
      { normalized: false },
      { status: "finished" },
      { regulationScore: null },
    ])
      expect(
        projectStandings(members, [{ ...match, ...invalid }], [], rules)
          .projectedGames,
      ).toBe(0);
  });
});
describe("provider regulation-time separation", () => {
  const raw = {
    id: 1,
    utcDate: time,
    status: "EXTRA_TIME",
    stage: "FINAL",
    homeTeam: { id: 1, name: "A" },
    awayTeam: { id: 2, name: "B" },
    score: {
      duration: "EXTRA_TIME",
      winner: null,
      fullTime: { home: 3, away: 2 },
      halfTime: { home: 1, away: 0 },
      regularTime: { home: 2, away: 2 },
    },
  };
  it("supports extra-time and shootout statuses without counting those goals in projections", () => {
    for (const status of ["EXTRA_TIME", "PENALTY_SHOOTOUT"]) {
      const parsed = fdMatchSchema.parse({
        ...raw,
        status,
        score: { ...raw.score, duration: status },
      });
      const { match } = normalizeFootballDataMatch(parsed, parsed);
      expect(match.result.status).toBe("live");
      expect(match.result.regularResult).toBeNull();
      expect(match.liveDetails?.regulationScore).toEqual({ home: 2, away: 2 });
    }
  });
  it("does not guess a regulation result and rejects negative provider scores", () => {
    const parsed = fdMatchSchema.parse({
      ...raw,
      score: { ...raw.score, regularTime: undefined },
    });
    expect(
      normalizeFootballDataMatch(parsed, parsed).match.liveDetails
        ?.regulationScore,
    ).toBeNull();
    expect(
      fdMatchSchema.safeParse({
        ...raw,
        score: { ...raw.score, fullTime: { home: -1, away: 0 } },
      }).success,
    ).toBe(false);
  });
  it("keeps a valid score when optional event coverage is malformed", () => {
    const parsed = fdMatchSchema.parse({
      ...raw,
      minute: "unknown",
      lastUpdated: "invalid",
      bookings: [{ card: "UNKNOWN" }],
    });
    const { match } = normalizeFootballDataMatch(parsed, parsed);
    expect(match.result.liveScore).toEqual({ home: 3, away: 2 });
    expect(match.liveDetails).toMatchObject({
      cards: null,
      minute: null,
      sourceUpdatedAt: null,
    });
  });
});
