/**
 * Unit coverage for `upsertCanonicalMatch`'s trickiest logic: the
 * lock-time-preservation branch (never silently move an admin-configured
 * lock time — see the doc comment in upsert-matches.ts). Mocks
 * `@/lib/db/client` rather than hitting a real database, both because that
 * branch is pure decision logic independent of the actual SQL, and because
 * `lib/db/client.ts` carries `import "server-only"` and can't be exercised
 * by a plain script outside Next's request lifecycle (the create/update/
 * idempotency paths were already smoke-tested end-to-end against the live
 * dev database via a manual /api/cron/sync run — see PR notes).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CanonicalMatch } from "../providers/types";

const { selectQueue, insertValuesCalls, insertReturningQueue, updateSetCalls } =
  vi.hoisted(() => ({
    selectQueue: [] as unknown[][],
    insertValuesCalls: [] as unknown[],
    insertReturningQueue: [] as unknown[][],
    updateSetCalls: [] as unknown[],
  }));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectQueue.shift() ?? []),
        }),
      }),
    })),
    insert: vi.fn(() => ({
      values: (v: unknown) => {
        insertValuesCalls.push(v);
        return {
          returning: () => Promise.resolve(insertReturningQueue.shift() ?? []),
        };
      },
    })),
    update: vi.fn(() => ({
      set: (v: unknown) => {
        updateSetCalls.push(v);
        return { where: () => Promise.resolve(undefined) };
      },
    })),
  },
}));

const { upsertCanonicalMatch } = await import("./upsert-matches");

function canonicalMatch(
  overrides: Partial<CanonicalMatch> = {},
): CanonicalMatch {
  return {
    providerId: "fd-999",
    stage: "group",
    group: "A",
    matchday: 1,
    homeTeam: { providerId: "fd-1", name: "Home FC", shortName: "HOM" },
    awayTeam: { providerId: "fd-2", name: "Away FC", shortName: "AWY" },
    kickoff: "2026-08-01T18:00:00.000Z",
    result: {
      status: "scheduled",
      regularResult: null,
      extraTimeResult: null,
      penaltyResult: null,
      liveScore: null,
      winner: null,
    },
    rawProviderPayload: {},
    warning: null,
    ...overrides,
  };
}

beforeEach(() => {
  selectQueue.length = 0;
  insertValuesCalls.length = 0;
  insertReturningQueue.length = 0;
  updateSetCalls.length = 0;
});

describe("upsertCanonicalMatch — lock-time semantics", () => {
  it("sets lockTime = kickoff when creating a new match", async () => {
    // resolveTeamId(home): not found -> insert
    selectQueue.push([]);
    insertReturningQueue.push([{ id: "home-id" }]);
    // resolveTeamId(away): not found -> insert
    selectQueue.push([]);
    insertReturningQueue.push([{ id: "away-id" }]);
    // findExistingMatch: not found
    selectQueue.push([]);
    // insert match
    insertReturningQueue.push([{ id: "match-id" }]);

    const outcome = await upsertCanonicalMatch("tid", canonicalMatch());

    expect(outcome).toEqual({
      matchId: "match-id",
      created: true,
      warnings: [],
    });
    const matchInsert = insertValuesCalls[2] as {
      lockTime: Date;
      kickoff: Date;
    };
    expect(matchInsert.lockTime.toISOString()).toBe("2026-08-01T18:00:00.000Z");
    expect(matchInsert.lockTime.getTime()).toBe(matchInsert.kickoff.getTime());
  });

  it("leaves lockTime untouched when kickoff hasn't changed", async () => {
    selectQueue.push([{ id: "home-id" }]); // home team found
    selectQueue.push([{ id: "away-id" }]); // away team found
    const sameKickoff = new Date("2026-08-01T18:00:00.000Z");
    const customLock = new Date("2026-08-01T12:00:00.000Z"); // admin moved it earlier
    selectQueue.push([
      { id: "match-id", kickoff: sameKickoff, lockTime: customLock },
    ]);

    const outcome = await upsertCanonicalMatch(
      "tid",
      canonicalMatch({ kickoff: sameKickoff.toISOString() }),
    );

    expect(outcome).toEqual({
      matchId: "match-id",
      created: false,
      warnings: [],
    });
    const matchUpdate = updateSetCalls[0] as { lockTime: Date };
    expect(matchUpdate.lockTime.getTime()).toBe(customLock.getTime());
  });

  it("auto-moves lockTime with a rescheduled kickoff when it was never customized", async () => {
    selectQueue.push([{ id: "home-id" }]);
    selectQueue.push([{ id: "away-id" }]);
    const oldKickoff = new Date("2026-08-01T18:00:00.000Z");
    // lockTime === kickoff means "never customized" per upsert-matches.ts
    selectQueue.push([
      { id: "match-id", kickoff: oldKickoff, lockTime: oldKickoff },
    ]);

    const newKickoff = "2026-08-02T20:00:00.000Z";
    const outcome = await upsertCanonicalMatch(
      "tid",
      canonicalMatch({ kickoff: newKickoff }),
    );

    expect(outcome.warnings).toEqual([]);
    const matchUpdate = updateSetCalls[0] as { lockTime: Date };
    expect(matchUpdate.lockTime.toISOString()).toBe(newKickoff);
  });

  it("preserves an admin-customized lockTime and warns when the provider reschedules", async () => {
    selectQueue.push([{ id: "home-id" }]);
    selectQueue.push([{ id: "away-id" }]);
    const oldKickoff = new Date("2026-08-01T18:00:00.000Z");
    const customLock = new Date("2026-08-01T12:00:00.000Z"); // != oldKickoff -> customized
    selectQueue.push([
      { id: "match-id", kickoff: oldKickoff, lockTime: customLock },
    ]);

    const newKickoff = "2026-08-02T20:00:00.000Z";
    const outcome = await upsertCanonicalMatch(
      "tid",
      canonicalMatch({ kickoff: newKickoff }),
    );

    expect(outcome.warnings).toHaveLength(1);
    expect(outcome.warnings[0]).toContain(
      "lock_time was left as admin-configured",
    );
    const matchUpdate = updateSetCalls[0] as { lockTime: Date };
    // lockTime must stay at the admin's custom value, not move to newKickoff.
    expect(matchUpdate.lockTime.getTime()).toBe(customLock.getTime());
  });
});
