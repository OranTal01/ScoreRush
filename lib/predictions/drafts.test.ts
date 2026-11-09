import { describe, it, expect } from "vitest";
import { decodeDraft, draftKey, DRAFT_MAX_AGE } from "./drafts";
const now = 1789300000000;
const base = {
  version: 1,
  home: "0",
  away: "2",
  baseline: "unsubmitted",
  updatedAt: now - 10,
};
describe("device prediction drafts", () => {
  it("restores zero and incomplete picks without submitting", () => {
    expect(decodeDraft(JSON.stringify(base), "unsubmitted", now)).toEqual(base);
    expect(
      decodeDraft(JSON.stringify({ ...base, away: "" }), "unsubmitted", now)
        ?.away,
    ).toBe("");
  });
  it("isolates the tournament, participant and match", () => {
    expect(draftKey("a:p", "match")).not.toBe(draftKey("b:p", "match"));
    expect(draftKey("a:p", "match")).not.toBe(draftKey("a:q", "match"));
    expect(draftKey("a:p", "match")).not.toBe(draftKey("a:p", "other"));
  });
  it("rejects stale server baselines and expired or invalid local input", () => {
    expect(decodeDraft(JSON.stringify(base), "1:1", now)).toBeNull();
    for (const invalid of [
      { version: 2 },
      { home: "100" },
      { home: "-1" },
      { home: "NaN" },
      { away: 2 },
      { home: "", away: "" },
      { updatedAt: now + 1 },
      { updatedAt: now - DRAFT_MAX_AGE - 1 },
    ])
      expect(
        decodeDraft(
          JSON.stringify({ ...base, ...invalid }),
          "unsubmitted",
          now,
        ),
      ).toBeNull();
    expect(decodeDraft("{", "unsubmitted", now)).toBeNull();
  });
});
