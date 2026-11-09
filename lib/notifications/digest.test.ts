import { describe, it, expect } from "vitest";
import { buildDigest } from "./digest";
const p = (id: string, rank: number, total: number, gained = 9) => ({
  id,
  name: id,
  rank,
  total,
  gained,
  exact: 1,
});
describe("evening recap", () => {
  it("includes the entire tied podium, joint stars and an evidenced change of leader", () => {
    const text = buildDigest(
      "החברים",
      "2026-10-20",
      [
        p("דן", 1, 60),
        p("אורן", 2, 54),
        p("נועם", 2, 54),
        p("אבי", 2, 54),
        p("יוסי", 2, 54),
        p("לירן", 2, 54),
        p("אחרון", 7, 9, 0),
      ],
      [p("דן", 3, 51), p("אורן", 1, 54)],
      9,
    );
    expect(text).toContain("2. לירן — 54");
    expect(text).not.toContain("7. אחרון");
    expect(text).toContain("מהפך בפסגה: דן");
    expect(text).toContain("עלייה של 2 מקומות");
    expect(text).toContain("20.10.2026 · 9 משחקים");
  });
  it("does not invent movement, a change of leader, or a winner without points", () => {
    const text = buildDigest(
      "החברים",
      "2026-10-20",
      [p("דן", 1, 0, 0)],
      null,
      1,
    );
    expect(text).not.toContain("מהפך");
    expect(text).not.toContain("הקפיצה");
    expect(text).not.toContain("כוכבי הערב");
  });
});
