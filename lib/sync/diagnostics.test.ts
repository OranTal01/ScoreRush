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

const { getRecentSyncLogs, getFlaggedMatches } = await import("./diagnostics");

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

    const result = await getRecentSyncLogs();

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
    expect(await getRecentSyncLogs()).toEqual([]);
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

    const result = await getFlaggedMatches();

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
    expect(await getFlaggedMatches()).toEqual([]);
  });
});
