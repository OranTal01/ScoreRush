/**
 * Mocks `@/lib/db/client` rather than hitting a real database — same
 * rationale and shared-queue pattern as lib/sync/diagnostics.test.ts: these
 * queries are pure shape/mapping/merge logic, independent of the actual
 * SQL, and `lib/db/client.ts` carries `import "server-only"`.
 *
 * getAuditLog's two main queries run inside one `Promise.all([...])`, whose
 * array argument is evaluated left-to-right synchronously — each chain call
 * (including the mocked `.limit()`) runs at chain-build time, not at await
 * time — so the queue is shifted in source order: overrides query, then
 * score-audit-logs query. A third, sequential (not Promise.all'd) query for
 * match team names follows only when at least one "match"-entity row came
 * back.
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

const { getAuditLog } = await import("./log");

beforeEach(() => {
  queue.length = 0;
});

describe("getAuditLog", () => {
  it("returns an empty array when neither table has any rows for the tournament", async () => {
    queue.push([]); // admin_overrides
    queue.push([]); // score_audit_logs

    expect(await getAuditLog("tournament-1")).toEqual([]);
  });

  it("merges override and score-change entries, newest first, and resolves match team names", async () => {
    queue.push([
      {
        id: "override-1",
        createdAt: new Date("2026-07-20T10:00:00.000Z"),
        actingAdminName: "Dana Admin",
        reason: "Provider returned a wrong score, verified against broadcast",
        evidenceRef: "https://example.com/broadcast-clip",
        reversible: true,
        reversedAt: null,
      },
    ]);
    queue.push([
      {
        id: "audit-1",
        createdAt: new Date("2026-07-20T10:00:05.000Z"),
        actingAdminName: "Dana Admin",
        reason: "Provider returned a wrong score, verified against broadcast",
        entity: "match",
        entityId: "match-1",
        field: "regular_result",
        previousValue: { home: 1, away: 1 },
        newValue: { home: 2, away: 1 },
      },
      {
        id: "audit-2",
        createdAt: new Date("2026-07-19T09:00:00.000Z"),
        actingAdminName: "Dana Admin",
        reason: "Provider returned a wrong score, verified against broadcast",
        entity: "match",
        entityId: "match-1",
        field: "winner",
        previousValue: "draw",
        newValue: "home",
      },
    ]);
    queue.push([
      { id: "match-1", homeTeamName: "Argentina", awayTeamName: "Mexico" },
    ]);

    const result = await getAuditLog("tournament-1");

    expect(result).toEqual([
      {
        type: "score_change",
        id: "audit-1",
        timestamp: "2026-07-20T10:00:05.000Z",
        actingAdminName: "Dana Admin",
        reason: "Provider returned a wrong score, verified against broadcast",
        entity: "match",
        entityId: "match-1",
        field: "regular_result",
        previousValue: { home: 1, away: 1 },
        newValue: { home: 2, away: 1 },
        match: { homeTeamName: "Argentina", awayTeamName: "Mexico" },
      },
      {
        type: "override",
        id: "override-1",
        timestamp: "2026-07-20T10:00:00.000Z",
        actingAdminName: "Dana Admin",
        reason: "Provider returned a wrong score, verified against broadcast",
        evidenceRef: "https://example.com/broadcast-clip",
        reversible: true,
        reversedAt: null,
      },
      {
        type: "score_change",
        id: "audit-2",
        timestamp: "2026-07-19T09:00:00.000Z",
        actingAdminName: "Dana Admin",
        reason: "Provider returned a wrong score, verified against broadcast",
        entity: "match",
        entityId: "match-1",
        field: "winner",
        previousValue: "draw",
        newValue: "home",
        match: { homeTeamName: "Argentina", awayTeamName: "Mexico" },
      },
    ]);
  });

  it("does not query for match labels when no score-change row references a match", async () => {
    queue.push([]); // admin_overrides
    queue.push([]); // score_audit_logs

    await getAuditLog("tournament-1");

    // Only the two Promise.all'd queries should have consumed the queue —
    // if getMatchLabels queried unnecessarily it would try to shift a third,
    // never-pushed item and fall back to `[]` silently, so this asserts the
    // queue was left exactly empty (no leftover, no over-consumption).
    expect(queue.length).toBe(0);
  });

  it("sets match to null when a score-change row's match id has no matching label (defensive)", async () => {
    queue.push([]); // admin_overrides
    queue.push([
      {
        id: "audit-1",
        createdAt: new Date("2026-07-20T10:00:00.000Z"),
        actingAdminName: "Dana Admin",
        reason: "reason",
        entity: "match",
        entityId: "missing-match",
        field: "winner",
        previousValue: "draw",
        newValue: "home",
      },
    ]);
    queue.push([]); // match label lookup finds nothing

    const result = await getAuditLog("tournament-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "score_change", match: null });
  });

  it("marks a reversed override with its reversedAt timestamp", async () => {
    queue.push([
      {
        id: "override-1",
        createdAt: new Date("2026-07-18T10:00:00.000Z"),
        actingAdminName: "Dana Admin",
        reason: "reason",
        evidenceRef: null,
        reversible: true,
        reversedAt: new Date("2026-07-19T10:00:00.000Z"),
      },
    ]);
    queue.push([]); // score_audit_logs

    const result = await getAuditLog("tournament-1");

    expect(result).toEqual([
      {
        type: "override",
        id: "override-1",
        timestamp: "2026-07-18T10:00:00.000Z",
        actingAdminName: "Dana Admin",
        reason: "reason",
        evidenceRef: null,
        reversible: true,
        reversedAt: "2026-07-19T10:00:00.000Z",
      },
    ]);
  });
});
