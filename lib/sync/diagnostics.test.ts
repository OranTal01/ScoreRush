/**
 * Mocks `@/lib/db/client` rather than hitting a real database (same
 * rationale as upsert-matches.test.ts: these queries are pure shape/mapping
 * logic — ISO-string conversion, null-narrowing — independent of the actual
 * SQL, and `lib/db/client.ts` carries `import "server-only"`.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { queue } = vi.hoisted(() => ({ queue: [] as unknown[][] }));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => {
      const chain: {
        from: () => typeof chain;
        innerJoin: () => typeof chain;
        where: () => typeof chain;
        orderBy: () => typeof chain;
        limit: () => Promise<unknown[]>;
      } = {
        from: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => Promise.resolve(queue.shift() ?? []),
      };
      return chain;
    },
  },
}));

const {
  getRecentSyncLogs,
  getFlaggedMatches,
  getProviderHealth,
  getMatchDiagnosticsList,
  getMatchDiagnostic,
} = await import("./diagnostics");

beforeEach(() => {
  queue.length = 0;
});

describe("getRecentSyncLogs", () => {
  it("converts the timestamp to an ISO string", async () => {
    queue.push([
      {
        id: "log-1",
        tournamentName: "World Cup 2026",
        provider: "football_data_org",
        outcome: "success",
        durationMs: 842,
        errorDetail: null,
        timestamp: new Date("2026-07-23T06:00:00.000Z"),
      },
    ]);

    const result = await getRecentSyncLogs("tournament-1");

    expect(result).toEqual([
      {
        id: "log-1",
        tournamentName: "World Cup 2026",
        provider: "football_data_org",
        outcome: "success",
        durationMs: 842,
        errorDetail: null,
        timestamp: "2026-07-23T06:00:00.000Z",
      },
    ]);
  });

  it("returns an empty array when no sync has ever run", async () => {
    queue.push([]);
    expect(await getRecentSyncLogs("tournament-1")).toEqual([]);
  });
});

describe("getFlaggedMatches", () => {
  it("converts kickoff to an ISO string and narrows warningFlag to a plain string", async () => {
    queue.push([
      {
        id: "match-1",
        tournamentName: "World Cup 2026",
        homeTeamName: "Argentina",
        awayTeamName: "Mexico",
        kickoff: new Date("2026-06-12T18:00:00.000Z"),
        warningFlag:
          "football-data match 500006 is FINISHED but has no regulation-time score — flagged, not guessed",
      },
    ]);

    const result = await getFlaggedMatches("tournament-1");

    expect(result).toEqual([
      {
        id: "match-1",
        tournamentName: "World Cup 2026",
        homeTeamName: "Argentina",
        awayTeamName: "Mexico",
        kickoff: "2026-06-12T18:00:00.000Z",
        warningFlag:
          "football-data match 500006 is FINISHED but has no regulation-time score — flagged, not guessed",
      },
    ]);
  });

  it("returns an empty array when nothing is currently flagged", async () => {
    queue.push([]);
    expect(await getFlaggedMatches("tournament-1")).toEqual([]);
  });
});

describe("getProviderHealth", () => {
  // getProviderHealth Promise.all's a tournament_providers lookup with a
  // getRecentSyncLogs call — both go through the same mocked db.select()
  // chain, resolving in source order (same synchronous-queue pattern as
  // lib/auth/admin.test.ts's Promise.all'd queries), so push the
  // tournament_providers row array first, then the raw sync_logs rows.
  it("derives last-successful/last-attempt/outcome/error-count from recent sync logs", async () => {
    queue.push([
      { matchDataProvider: "football_data_org", bonusStatsProvider: "manual" },
    ]);
    queue.push([
      {
        id: "log-3",
        tournamentName: "World Cup 2026",
        provider: "football_data_org",
        outcome: "error",
        durationMs: 120,
        errorDetail: "timeout",
        timestamp: new Date("2026-07-23T08:00:00.000Z"),
      },
      {
        id: "log-2",
        tournamentName: "World Cup 2026",
        provider: "football_data_org",
        outcome: "error",
        durationMs: 300,
        errorDetail: "500",
        timestamp: new Date("2026-07-23T07:00:00.000Z"),
      },
      {
        id: "log-1",
        tournamentName: "World Cup 2026",
        provider: "football_data_org",
        outcome: "success",
        durationMs: 842,
        errorDetail: null,
        timestamp: new Date("2026-07-23T06:00:00.000Z"),
      },
    ]);

    const result = await getProviderHealth("tournament-1");

    expect(result).toEqual({
      matchDataProvider: "football_data_org",
      bonusStatsProvider: "manual",
      lastSuccessfulSyncAt: "2026-07-23T06:00:00.000Z",
      lastAttemptAt: "2026-07-23T08:00:00.000Z",
      lastOutcome: "error",
      recentErrorCount: 2,
      recentAttemptCount: 3,
    });
  });

  it("returns null fields (not a crash) when no sync has ever been attempted", async () => {
    queue.push([
      { matchDataProvider: "manual", bonusStatsProvider: "manual" },
    ]);
    queue.push([]);

    const result = await getProviderHealth("tournament-1");

    expect(result).toEqual({
      matchDataProvider: "manual",
      bonusStatsProvider: "manual",
      lastSuccessfulSyncAt: null,
      lastAttemptAt: null,
      lastOutcome: null,
      recentErrorCount: 0,
      recentAttemptCount: 0,
    });
  });

  it("returns null when the tournament has no tournament_providers row", async () => {
    queue.push([]);
    queue.push([]);
    expect(await getProviderHealth("tournament-1")).toBeNull();
  });
});

describe("getMatchDiagnosticsList", () => {
  it("converts kickoff to an ISO string and passes through status/normalization fields", async () => {
    queue.push([
      {
        id: "match-1",
        homeTeamName: "Argentina",
        awayTeamName: "Mexico",
        kickoff: new Date("2026-06-12T18:00:00.000Z"),
        status: "finished",
        normalizationStatus: "flagged",
        warningFlag: "team order reversed vs. expected",
      },
      {
        id: "match-2",
        homeTeamName: "Brazil",
        awayTeamName: "Chile",
        kickoff: new Date("2026-06-13T18:00:00.000Z"),
        status: "scheduled",
        normalizationStatus: "pending",
        warningFlag: null,
      },
    ]);

    const result = await getMatchDiagnosticsList("tournament-1");

    expect(result).toEqual([
      {
        id: "match-1",
        homeTeamName: "Argentina",
        awayTeamName: "Mexico",
        kickoff: "2026-06-12T18:00:00.000Z",
        status: "finished",
        normalizationStatus: "flagged",
        warningFlag: "team order reversed vs. expected",
      },
      {
        id: "match-2",
        homeTeamName: "Brazil",
        awayTeamName: "Chile",
        kickoff: "2026-06-13T18:00:00.000Z",
        status: "scheduled",
        normalizationStatus: "pending",
        warningFlag: null,
      },
    ]);
  });

  it("returns an empty array when the tournament has no matches yet", async () => {
    queue.push([]);
    expect(await getMatchDiagnosticsList("tournament-1")).toEqual([]);
  });
});

describe("getMatchDiagnostic", () => {
  it("converts kickoff/lockTime/lastSyncedAt to ISO strings", async () => {
    queue.push([
      {
        id: "match-1",
        tournamentId: "tournament-1",
        homeTeamName: "Argentina",
        awayTeamName: "Mexico",
        providerId: "500006",
        stage: "group",
        status: "finished",
        kickoff: new Date("2026-06-12T18:00:00.000Z"),
        lockTime: new Date("2026-06-12T17:45:00.000Z"),
        regularResult: { home: 2, away: 1 },
        extraTimeResult: null,
        penaltyResult: null,
        liveScore: null,
        winner: "home",
        rawProviderPayload: { id: 500006, status: "FINISHED" },
        lastSyncedAt: new Date("2026-06-12T20:05:00.000Z"),
        normalizationStatus: "normalized",
        warningFlag: null,
      },
    ]);

    const result = await getMatchDiagnostic("match-1");

    expect(result).toEqual({
      id: "match-1",
      tournamentId: "tournament-1",
      homeTeamName: "Argentina",
      awayTeamName: "Mexico",
      providerId: "500006",
      stage: "group",
      status: "finished",
      kickoff: "2026-06-12T18:00:00.000Z",
      lockTime: "2026-06-12T17:45:00.000Z",
      regularResult: { home: 2, away: 1 },
      extraTimeResult: null,
      penaltyResult: null,
      liveScore: null,
      winner: "home",
      rawProviderPayload: { id: 500006, status: "FINISHED" },
      lastSyncedAt: "2026-06-12T20:05:00.000Z",
      normalizationStatus: "normalized",
      warningFlag: null,
    });
  });

  it("narrows lastSyncedAt to null for a manually-entered, never-synced match", async () => {
    queue.push([
      {
        id: "match-2",
        tournamentId: "tournament-1",
        homeTeamName: "Home Team",
        awayTeamName: "Away Team",
        providerId: null,
        stage: "final",
        status: "scheduled",
        kickoff: new Date("2026-07-01T18:00:00.000Z"),
        lockTime: new Date("2026-07-01T17:45:00.000Z"),
        regularResult: null,
        extraTimeResult: null,
        penaltyResult: null,
        liveScore: null,
        winner: null,
        rawProviderPayload: null,
        lastSyncedAt: null,
        normalizationStatus: "pending",
        warningFlag: null,
      },
    ]);

    const result = await getMatchDiagnostic("match-2");

    expect(result?.lastSyncedAt).toBeNull();
    expect(result?.rawProviderPayload).toBeNull();
    expect(result?.providerId).toBeNull();
  });

  it("returns null when the match doesn't exist", async () => {
    queue.push([]);
    expect(await getMatchDiagnostic("missing-match")).toBeNull();
  });
});
