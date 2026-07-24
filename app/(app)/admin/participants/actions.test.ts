/**
 * Unit coverage for the participant-management server actions (ROADMAP.md
 * Phase 7 task #59): `removeParticipant`, `changeParticipantRole`,
 * `revokeInvitation`, `createInvitation`. Mocks `@/lib/supabase/server`
 * (same synchronous-queue fake-chain pattern as
 * app/(app)/groups/actions.test.ts and lib/auth/admin.test.ts — `.from()`
 * shifts the next queued response immediately, so the two `Promise.all`'d
 * queries inside `getAdminContext` resolve deterministically in source
 * order) and `@/lib/auth/get-origin` (these actions run outside a real
 * request context in tests, so `headers()` isn't available).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { fromQueue, calls, authUser } = vi.hoisted(() => ({
  fromQueue: [] as { data: unknown; error: unknown }[],
  calls: [] as { table: string; op: string; payload?: unknown }[],
  authUser: { current: null as { id: string } | null },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/get-origin", () => ({
  getOrigin: async () => "https://example.com",
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: authUser.current } }),
    },
    from: (table: string) => {
      const response = fromQueue.shift() ?? { data: null, error: null };
      const promise = Promise.resolve(response);
      const chain: {
        select: () => typeof chain;
        eq: () => typeof chain;
        order: () => typeof chain;
        maybeSingle: () => Promise<unknown>;
        single: () => Promise<unknown>;
        then: Promise<unknown>["then"];
        catch: Promise<unknown>["catch"];
        insert: (payload: unknown) => typeof chain;
        update: (payload: unknown) => typeof chain;
        delete: () => typeof chain;
      } = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        maybeSingle: () => promise,
        single: () => promise,
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),
        insert: (payload: unknown) => {
          calls.push({ table, op: "insert", payload });
          return chain;
        },
        update: (payload: unknown) => {
          calls.push({ table, op: "update", payload });
          return chain;
        },
        delete: () => {
          calls.push({ table, op: "delete" });
          return chain;
        },
      };
      return chain;
    },
  }),
}));

const {
  removeParticipant,
  changeParticipantRole,
  revokeInvitation,
  createInvitation,
} = await import("./actions");

const T1 = "11111111-1111-4111-8111-111111111111";
const P1 = "22222222-2222-4222-8222-222222222222";
const I1 = "33333333-3333-4333-8333-333333333333";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

function queueAdmin({ isAdmin }: { isAdmin: boolean }) {
  fromQueue.push({ data: { is_platform_admin: isAdmin }, error: null }); // users
  fromQueue.push({ data: null, error: null }); // participants (role irrelevant once platform admin covers it)
}

beforeEach(() => {
  fromQueue.length = 0;
  calls.length = 0;
  authUser.current = null;
});

describe("removeParticipant", () => {
  it("rejects invalid input before touching auth", async () => {
    const result = await removeParticipant(
      { status: "idle" },
      formData({ participantId: "not-a-uuid", tournamentId: T1 }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
    expect(calls).toHaveLength(0);
  });

  it("rejects an unauthenticated caller", async () => {
    const result = await removeParticipant(
      { status: "idle" },
      formData({ participantId: P1, tournamentId: T1 }),
    );
    expect(result).toEqual({ status: "error", code: "unauthenticated" });
  });

  it("rejects a caller who isn't an admin of this tournament", async () => {
    authUser.current = { id: "u1" };
    queueAdmin({ isAdmin: false });
    const result = await removeParticipant(
      { status: "idle" },
      formData({ participantId: P1, tournamentId: T1 }),
    );
    expect(result).toEqual({ status: "error", code: "not_admin" });
  });

  it("reports not_found when the participant row is gone", async () => {
    authUser.current = { id: "u1" };
    queueAdmin({ isAdmin: true });
    fromQueue.push({ data: null, error: null }); // participant lookup — no row
    const result = await removeParticipant(
      { status: "idle" },
      formData({ participantId: P1, tournamentId: T1 }),
    );
    expect(result).toEqual({ status: "error", code: "not_found" });
  });

  it("refuses to let an admin remove themselves", async () => {
    authUser.current = { id: "u1" };
    queueAdmin({ isAdmin: true });
    fromQueue.push({ data: { user_id: "u1" }, error: null }); // participant lookup — it's them
    const result = await removeParticipant(
      { status: "idle" },
      formData({ participantId: P1, tournamentId: T1 }),
    );
    expect(result).toEqual({ status: "error", code: "cannot_remove_self" });
    expect(calls.filter((c) => c.op === "delete")).toHaveLength(0);
  });

  it("deletes another participant for an admin", async () => {
    authUser.current = { id: "u1" };
    queueAdmin({ isAdmin: true });
    fromQueue.push({ data: { user_id: "someone-else" }, error: null }); // participant lookup
    fromQueue.push({ data: null, error: null }); // delete result
    const result = await removeParticipant(
      { status: "idle" },
      formData({ participantId: P1, tournamentId: T1 }),
    );
    expect(result).toEqual({ status: "success" });
    expect(calls).toEqual([{ table: "participants", op: "delete" }]);
  });
});

describe("changeParticipantRole", () => {
  it("rejects an invalid role value", async () => {
    const result = await changeParticipantRole(
      { status: "idle" },
      formData({ participantId: P1, tournamentId: T1, role: "owner" }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
    expect(calls).toHaveLength(0);
  });

  it("rejects a caller who isn't an admin of this tournament", async () => {
    authUser.current = { id: "u1" };
    queueAdmin({ isAdmin: false });
    const result = await changeParticipantRole(
      { status: "idle" },
      formData({ participantId: P1, tournamentId: T1, role: "tournament_admin" }),
    );
    expect(result).toEqual({ status: "error", code: "not_admin" });
  });

  it("refuses to let an admin change their own role", async () => {
    authUser.current = { id: "u1" };
    queueAdmin({ isAdmin: true });
    fromQueue.push({ data: { user_id: "u1" }, error: null }); // participant lookup — it's them
    const result = await changeParticipantRole(
      { status: "idle" },
      formData({ participantId: P1, tournamentId: T1, role: "participant" }),
    );
    expect(result).toEqual({
      status: "error",
      code: "cannot_change_own_role",
    });
    expect(calls.filter((c) => c.op === "update")).toHaveLength(0);
  });

  it("promotes another participant to tournament_admin", async () => {
    authUser.current = { id: "u1" };
    queueAdmin({ isAdmin: true });
    fromQueue.push({ data: { user_id: "someone-else" }, error: null }); // participant lookup
    fromQueue.push({ data: null, error: null }); // update result
    const result = await changeParticipantRole(
      { status: "idle" },
      formData({ participantId: P1, tournamentId: T1, role: "tournament_admin" }),
    );
    expect(result).toEqual({ status: "success" });
    expect(calls).toEqual([
      {
        table: "participants",
        op: "update",
        payload: { role: "tournament_admin" },
      },
    ]);
  });
});

describe("revokeInvitation", () => {
  it("rejects invalid input before touching auth", async () => {
    const result = await revokeInvitation(
      { status: "idle" },
      formData({ invitationId: "not-a-uuid", tournamentId: T1 }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
    expect(calls).toHaveLength(0);
  });

  it("rejects a caller who isn't an admin of this tournament", async () => {
    authUser.current = { id: "u1" };
    queueAdmin({ isAdmin: false });
    const result = await revokeInvitation(
      { status: "idle" },
      formData({ invitationId: I1, tournamentId: T1 }),
    );
    expect(result).toEqual({ status: "error", code: "not_admin" });
  });

  it("reports not_found when the invitation isn't pending (or doesn't exist)", async () => {
    authUser.current = { id: "u1" };
    queueAdmin({ isAdmin: true });
    fromQueue.push({ data: null, error: null }); // update...select().maybeSingle() — no row matched
    const result = await revokeInvitation(
      { status: "idle" },
      formData({ invitationId: I1, tournamentId: T1 }),
    );
    expect(result).toEqual({ status: "error", code: "not_found" });
  });

  it("revokes a pending invitation for an admin", async () => {
    authUser.current = { id: "u1" };
    queueAdmin({ isAdmin: true });
    fromQueue.push({ data: { id: I1 }, error: null }); // update...select().maybeSingle() — revoked row
    const result = await revokeInvitation(
      { status: "idle" },
      formData({ invitationId: I1, tournamentId: T1 }),
    );
    expect(result).toEqual({ status: "success" });
    expect(calls).toEqual([
      { table: "invitations", op: "update", payload: { status: "revoked" } },
    ]);
  });
});

describe("createInvitation", () => {
  it("rejects a malformed bound email", async () => {
    const result = await createInvitation(
      { status: "idle" },
      formData({ tournamentId: T1, boundEmail: "not-an-email" }),
    );
    expect(result).toEqual({ status: "error", code: "invalid_input" });
    expect(calls).toHaveLength(0);
  });

  it("rejects a caller who isn't an admin of this tournament", async () => {
    authUser.current = { id: "u1" };
    queueAdmin({ isAdmin: false });
    const result = await createInvitation(
      { status: "idle" },
      formData({ tournamentId: T1, boundEmail: "" }),
    );
    expect(result).toEqual({ status: "error", code: "not_admin" });
  });

  it("creates an open invitation (no bound email) and returns its join link", async () => {
    authUser.current = { id: "u1" };
    queueAdmin({ isAdmin: true });
    fromQueue.push({ data: { token: "returned-token" }, error: null }); // insert().select("token").single()

    const result = await createInvitation(
      { status: "idle" },
      formData({ tournamentId: T1, boundEmail: "" }),
    );

    expect(result).toEqual({
      status: "success",
      joinUrl: "https://example.com/join/returned-token",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("invitations");
    expect(calls[0].op).toBe("insert");
    const payload = calls[0].payload as Record<string, unknown>;
    expect(payload.tournament_id).toBe(T1);
    expect(payload.bound_email).toBeNull();
    expect(payload.created_by).toBe("u1");
    expect(typeof payload.token).toBe("string");
    expect(typeof payload.expires_at).toBe("string");
  });

  it("creates an invitation bound to a specific email", async () => {
    authUser.current = { id: "u1" };
    queueAdmin({ isAdmin: true });
    fromQueue.push({ data: { token: "returned-token" }, error: null });

    const result = await createInvitation(
      { status: "idle" },
      formData({ tournamentId: T1, boundEmail: "friend@example.com" }),
    );

    expect(result).toEqual({
      status: "success",
      joinUrl: "https://example.com/join/returned-token",
    });
    const payload = calls[0].payload as Record<string, unknown>;
    expect(payload.bound_email).toBe("friend@example.com");
  });
});
