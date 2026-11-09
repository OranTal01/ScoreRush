import { describe, it, expect } from "vitest";
import { reminderWindow, isMissingPrediction, israelDay } from "./policy";
import { buildDigest } from "./digest";
describe("notification policy", () => {
  it("sends only in the two reminder windows", () => {
    const lock = new Date("2026-10-13T16:40:00Z");
    expect(reminderWindow(new Date("2026-10-12T16:45:00Z"), lock)).toBe(
      "day-before",
    );
    expect(reminderWindow(new Date("2026-10-13T14:45:00Z"), lock)).toBe(
      "same-day",
    );
    expect(reminderWindow(new Date("2026-10-13T17:00:00Z"), lock)).toBeNull();
  });
  it("treats a saved 0–0 as submitted and a default as missing", () => {
    expect(isMissingPrediction(undefined)).toBe(true);
    expect(isMissingPrediction({ isDefault: true })).toBe(true);
    expect(isMissingPrediction({ isDefault: false })).toBe(false);
  });
  it("groups dates using Israel time and observes quiet hours", () => {
    expect(israelDay(new Date("2026-09-11T22:30:00Z"))).toBe("2026-09-12");
    expect(
      reminderWindow(
        new Date("2026-09-11T22:30:00Z"),
        new Date("2026-09-12T22:00:00Z"),
      ),
    ).toBeNull();
  });
  it("describes ties honestly and reports movement only with a baseline", () => {
    const current = [
      { id: "a", name: "אורן", rank: 1, total: 60, gained: 9, exact: 1 },
      { id: "b", name: "לירן", rank: 1, total: 60, gained: 0, exact: 0 },
    ];
    const report = buildDigest("החברים", "2026-09-11", current, null, 2);
    expect(report).toContain("חולקים את המקום הראשון");
    expect(report).not.toContain("עלייה");
    expect(
      buildDigest(
        "החברים",
        "2026-09-11",
        current,
        [{ ...current[0], rank: 2 }, current[1]],
        2,
      ),
    ).toContain("עלייה של 1");
  });
});
