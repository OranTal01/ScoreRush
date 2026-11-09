import { describe, expect, it } from "vitest";
import { digestHighlights } from "./highlights";
const a = { id: "a", name: "א", rank: 1, total: 30, gained: 9, exact: 1 };
const b = { ...a, id: "b", name: "ב" };
describe("summary highlights", () => {
  it("includes joint stars and avoids invented movement without a baseline", () => {
    const h = digestHighlights([a, b], null);
    expect(h.stars).toHaveLength(2);
    expect(h.leaders).toHaveLength(2);
    expect(h.movers).toEqual([]);
    expect(h.gap).toBe(0);
  });
  it("excludes zero scorers from star awards and newcomers from rank movement", () => {
    expect(
      digestHighlights([{ ...a, gained: 0, exact: 0 }], null).stars,
    ).toEqual([]);
    expect(digestHighlights([a, b], [{ ...a, rank: 4 }]).movers).toEqual([
      { ...a, up: 3 },
    ]);
    expect(digestHighlights([], null).gap).toBeNull();
  });
});
