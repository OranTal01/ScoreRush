import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eligibleDigest,
  deliverDigest,
  deliverOnce,
  reminderMessage,
  reminderWindow,
  kickoffWindow,
  kickoffMessage,
} from "./policy.mjs";
const now = new Date("2026-10-20T22:00:00Z");
const digest = {
  id: "d",
  day: "2026-10-20",
  body: "סיכום",
  published_at: "2026-10-20T21:40:00Z",
};
const fresh = () => ({ activatedAt: "2026-10-15T12:00:00Z", deliveries: {} });
test("no historical, stale, future, blank, or duplicate recaps", () => {
  const state = fresh();
  assert.equal(eligibleDigest(digest, state, +now), true);
  for (const d of [
    { ...digest, published_at: "2026-10-14T21:00:00Z" },
    { ...digest, published_at: "2026-10-18T21:00:00Z" },
    { ...digest, published_at: "2026-10-21T21:00:00Z" },
    { ...digest, body: "" },
  ])
    assert.equal(eligibleDigest(d, state, +now), false);
  state.deliveries.d = { status: "sending" };
  assert.equal(eligibleDigest(digest, state, +now), false);
});

test("kickoff notice is available only in the ten minutes before first game", () => {
  const kickoff = new Date("2026-11-04T17:45:00Z");
  assert.equal(kickoffWindow(new Date("2026-11-04T17:35:01Z"), kickoff), true);
  assert.equal(kickoffWindow(new Date("2026-11-04T17:34:59Z"), kickoff), false);
  assert.equal(kickoffWindow(new Date("2026-11-04T17:44:01Z"), kickoff), false);
  assert.match(
    kickoffMessage({ matchday: 4, games: 9 }, "https://example.com"),
    /9 משחקים/,
  );
});
test("persists recipient and intent before send; never sends twice", async () => {
  const state = fresh(),
    events = [];
  const opts = {
    digest,
    state,
    groupId: "allowed@g.us",
    now,
    persist: async () => events.push(state.deliveries.d.status),
    send: async (id, body) => {
      assert.equal(id, "allowed@g.us");
      assert.equal(body, "סיכום");
      events.push("send");
      return { id: { _serialized: "confirmed" } };
    },
  };
  assert.equal(await deliverDigest(opts), "sent");
  assert.deepEqual(events, ["sending", "send", "sent"]);
  assert.equal(await deliverDigest(opts), "skipped");
});
test("ambiguous delivery is retained across restart and not retried", async () => {
  const state = fresh();
  assert.equal(
    await deliverDigest({
      digest,
      state,
      groupId: "g",
      now,
      persist: async () => {},
      send: async () => {
        throw Error("timeout");
      },
    }),
    "uncertain",
  );
  assert.equal(
    eligibleDigest(digest, JSON.parse(JSON.stringify(state)), +now),
    false,
  );
});
test("failed intent persistence prevents any send", async () => {
  let sent = false;
  await assert.rejects(
    deliverDigest({
      digest,
      state: fresh(),
      groupId: "g",
      now,
      persist: async () => {
        throw Error("disk");
      },
      send: async () => {
        sent = true;
      },
    }),
  );
  assert.equal(sent, false);
});

test("opens one reminder window the evening before and one on match day", () => {
  const lock = new Date("2026-10-20T16:44:00Z");
  assert.equal(
    reminderWindow(new Date("2026-10-19T15:01:00Z"), lock),
    "day-before",
  );
  assert.equal(
    reminderWindow(new Date("2026-10-20T06:01:00Z"), lock),
    "same-day",
  );
  assert.equal(reminderWindow(new Date("2026-10-19T12:00:00Z"), lock), null);
  assert.equal(reminderWindow(new Date("2026-10-20T16:45:00Z"), lock), null);
});

test("builds a Hebrew group reminder without exposing member names", () => {
  const body = reminderMessage(
    {
      matchday: 3,
      first_kickoff: "2026-10-20T16:45:00Z",
      missing_picks: 12,
      missing_people: 4,
    },
    "day-before",
    "https://scorerush-sigma.vercel.app",
  );
  assert.match(body, /מחר מתחיל מחזור 3/);
  assert.match(body, /12 ניחושים אצל 4 חברים/);
  assert.match(body, /scorerush-sigma\.vercel\.app\/predictions/);
});

test("a reminder delivery is persisted and acknowledged only once", async () => {
  const state = fresh(),
    events = [];
  const opts = {
    key: "reminder:league_stage:3:day-before",
    body: "תזכורת",
    metadata: { kind: "reminder" },
    groupId: "allowed@g.us",
    state,
    now,
    persist: async () => events.push(state.deliveries[opts.key].status),
    send: async () => {
      events.push("send");
      return { id: { _serialized: "confirmed-reminder" } };
    },
  };
  assert.equal(await deliverOnce(opts), "sent");
  assert.deepEqual(events, ["sending", "send", "sent"]);
  assert.equal(await deliverOnce(opts), "skipped");
});
